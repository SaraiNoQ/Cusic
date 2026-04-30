import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthTokenPairDto,
  LoginDto,
  RefreshDto,
  RequestEmailCodeDto,
  UserProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard, RequestWithUser } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';

interface RequestContext extends RequestWithUser {
  ip?: string;
  headers: RequestWithUser['headers'] & {
    'user-agent'?: string | string[];
    'x-forwarded-for'?: string | string[];
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/request-code')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code requested' })
  async requestCode(
    @Body() body: RequestEmailCodeDto,
    @Req() request: RequestContext,
  ) {
    return {
      success: true,
      data: await this.authService.requestEmailCode(
        body.email,
        this.getClientIp(request),
        this.getHeaderValue(request.headers['user-agent']),
      ),
      meta: {},
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email verification code' })
  @ApiResponse({
    status: 200,
    description: 'Login success',
    type: AuthTokenPairDto,
  })
  async login(@Body() body: LoginDto, @Req() request: RequestContext) {
    return {
      success: true,
      data: await this.authService.login(
        body.email,
        body.code,
        this.getClientIp(request),
        this.getHeaderValue(request.headers['user-agent']),
      ),
      meta: {},
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Refresh success',
    type: AuthTokenPairDto,
  })
  async refresh(@Body() body: RefreshDto) {
    return {
      success: true,
      data: await this.authService.refresh(body.refreshToken),
      meta: {},
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200, description: 'Logout success' })
  async logout(@Body() body: RefreshDto) {
    return {
      success: true,
      data: await this.authService.logout(body.refreshToken),
      meta: {},
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserProfileDto,
  })
  async me(@Req() request: RequestContext) {
    return {
      success: true,
      data: await this.authService.getCurrentUser(request.user!.id),
      meta: {},
    };
  }

  private getClientIp(request: RequestContext) {
    return (
      this.getHeaderValue(request.headers['x-forwarded-for'])?.split(',')[0] ??
      request.ip
    );
  }

  private getHeaderValue(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
  }
}
