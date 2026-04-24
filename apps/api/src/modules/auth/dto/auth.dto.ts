import { IsEmail, IsString, Length } from 'class-validator';

export class RequestEmailCodeDto {
  @IsEmail()
  email!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class UserProfileDto {
  id!: string;
  email!: string;
  displayName!: string;
  avatarUrl!: string | null;
}

export class AuthTokenPairDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user?: UserProfileDto;
}
