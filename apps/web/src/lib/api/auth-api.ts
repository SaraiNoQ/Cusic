import type {
  ApiSuccessEnvelope,
  AuthTokenPairDto,
  AuthUserDto,
  LogoutResponseDto,
  RequestEmailCodeResponseDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export async function requestEmailCode(email: string) {
  const response = await apiFetch<
    ApiSuccessEnvelope<RequestEmailCodeResponseDto>
  >(
    '/auth/email/request-code',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function loginWithEmailCode(email: string, code: string) {
  const response = await apiFetch<ApiSuccessEnvelope<AuthTokenPairDto>>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await apiFetch<ApiSuccessEnvelope<AuthUserDto>>('/auth/me');
  return response.data;
}

export async function logoutWithRefreshToken(refreshToken: string) {
  const response = await apiFetch<ApiSuccessEnvelope<LogoutResponseDto>>(
    '/auth/logout',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    },
    { skipAuthRefresh: true },
  );
  return response.data;
}
