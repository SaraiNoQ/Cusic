import type { AuthTokenPairDto, AuthUserDto } from '@music-ai/shared';

const ACCESS_TOKEN_KEY = 'cusic.accessToken';
const REFRESH_TOKEN_KEY = 'cusic.refreshToken';
const USER_KEY = 'cusic.user';

export function readAuthSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const userJson = window.localStorage.getItem(USER_KEY);
  const user = userJson ? (JSON.parse(userJson) as AuthUserDto) : null;

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export function writeAuthSession(tokens: AuthTokenPairDto) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  if (tokens.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
