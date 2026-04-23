import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

class RequestEmailCodeDto {
  @IsEmail()
  email!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 12)
  code!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class UserProfileDto {
  id!: string;
  email!: string;
  displayName!: string;
  avatarUrl!: string | null;
}

class AuthTokenPairDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;

  @ValidateNested()
  @Type(() => UserProfileDto)
  @IsOptional()
  user?: UserProfileDto;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('email/request-code')
  @ApiOperation({ summary: 'Request email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code requested' })
  requestCode(@Body() body: RequestEmailCodeDto) {
    return {
      success: true,
      data: {
        email: body.email,
        cooldownSeconds: 60,
      },
      meta: {},
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email verification code' })
  @ApiResponse({ status: 200, description: 'Login success', type: AuthTokenPairDto })
  login(@Body() body: LoginDto) {
    return {
      success: true,
      data: {
        accessToken: 'stub-access-token',
        refreshToken: 'stub-refresh-token',
        expiresIn: 1800,
        user: {
          id: 'usr_stub',
          email: body.email,
          displayName: 'Cusic User',
          avatarUrl: null,
        },
      },
      meta: {},
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Refresh success', type: AuthTokenPairDto })
  refresh(@Body() body: RefreshDto) {
    return {
      success: true,
      data: {
        accessToken: 'stub-access-token-refreshed',
        refreshToken: body.refreshToken,
        expiresIn: 1800,
      },
      meta: {},
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200, description: 'Logout success' })
  logout(@Body() body: RefreshDto) {
    return {
      success: true,
      data: {
        loggedOut: true,
        refreshToken: body.refreshToken,
      },
      meta: {},
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  me() {
    return {
      success: true,
      data: {
        id: 'usr_stub',
        email: 'user@example.com',
        displayName: 'Cusic User',
        avatarUrl: null,
      },
      meta: {},
    };
  }
}
