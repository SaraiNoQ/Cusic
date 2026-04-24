import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IdentityType, User, UserStatus } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { authError } from '../auth.errors';
import { MailerService } from './mailer.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds = Number(
    process.env.JWT_ACCESS_TTL_SECONDS ?? 1800,
  );
  private readonly refreshTtlSeconds = Number(
    process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async requestEmailCode(
    email: string,
    requestIp?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    await this.prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        userId: user?.id,
        codeHash: this.hashVerificationCode(normalizedEmail, code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        requestIp,
        userAgent,
      },
    });

    await this.mailerService.sendVerificationCode(normalizedEmail, code);

    return {
      cooldownSeconds: 60,
    };
  }

  async login(
    email: string,
    code: string,
    requestIp?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode || verificationCode.attemptCount >= 5) {
      throw authError(
        HttpStatus.BAD_REQUEST,
        'AUTH_CODE_INVALID',
        'Verification code is invalid or expired',
      );
    }

    const expectedHash = this.hashVerificationCode(normalizedEmail, code);
    if (verificationCode.codeHash !== expectedHash) {
      await this.prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw authError(
        HttpStatus.BAD_REQUEST,
        'AUTH_CODE_INVALID',
        'Verification code is invalid or expired',
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const upsertedUser = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
        create: {
          email: normalizedEmail,
          displayName: this.defaultDisplayName(normalizedEmail),
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      await tx.authIdentity.upsert({
        where: {
          identityType_identityKey: {
            identityType: IdentityType.EMAIL,
            identityKey: normalizedEmail,
          },
        },
        update: {
          userId: upsertedUser.id,
          isPrimary: true,
          verifiedAt: new Date(),
        },
        create: {
          userId: upsertedUser.id,
          identityType: IdentityType.EMAIL,
          identityKey: normalizedEmail,
          isPrimary: true,
          verifiedAt: new Date(),
        },
      });

      await tx.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: {
          userId: upsertedUser.id,
          usedAt: new Date(),
        },
      });

      return upsertedUser;
    });

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        clientIp: requestIp,
        userAgent,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });

    const refreshToken = this.createRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: this.toUserProfile(user),
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        session: true,
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.session.revokedAt ||
      storedToken.session.expiresAt <= new Date()
    ) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_REFRESH_INVALID',
        'Refresh token is invalid or expired',
      );
    }

    const nextRefreshToken = this.createRefreshToken();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          sessionId: storedToken.sessionId,
          userId: storedToken.userId,
          tokenHash: this.hashToken(nextRefreshToken),
          expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
          rotatedFromId: storedToken.id,
        },
      }),
      this.prisma.userSession.update({
        where: { id: storedToken.sessionId },
        data: { lastActiveAt: new Date() },
      }),
    ]);

    return {
      accessToken: await this.signAccessToken(
        storedToken.user,
        storedToken.sessionId,
      ),
      refreshToken: nextRefreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        }),
        this.prisma.userSession.update({
          where: { id: storedToken.sessionId },
          data: { revokedAt: new Date() },
        }),
      ]);
    }

    return { loggedOut: true };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.getAccessSecret(),
      });

      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sessionId },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.status !== UserStatus.ACTIVE
      ) {
        throw new Error('Session invalid');
      }

      return {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
      };
    } catch {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_TOKEN',
        'Access token is invalid or expired',
      );
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID_TOKEN',
        'Access token is invalid or expired',
      );
    }

    return this.toUserProfile(user);
  }

  private async signAccessToken(user: User, sessionId: string) {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.accessTtlSeconds,
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private defaultDisplayName(email: string) {
    return email.split('@')[0] || 'Cusic User';
  }

  private toUserProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? this.defaultDisplayName(user.email),
      avatarUrl: user.avatarUrl,
    };
  }

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashVerificationCode(email: string, code: string) {
    return createHash('sha256')
      .update(`${email}:${code}:${this.getAccessSecret()}`)
      .digest('hex');
  }

  private getAccessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw authError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_JWT_NOT_CONFIGURED',
        'JWT access secret is not configured',
      );
    }
    return secret;
  }
}
