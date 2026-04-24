import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { AuthService, AuthenticatedUser } from '../services/auth.service';
import { authError } from '../auth.errors';

export interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!header?.startsWith('Bearer ')) {
      throw authError(
        HttpStatus.UNAUTHORIZED,
        'AUTH_TOKEN_REQUIRED',
        'Authorization bearer token is required',
      );
    }

    request.user = await this.authService.verifyAccessToken(
      header.slice('Bearer '.length).trim(),
    );

    return true;
  }
}
