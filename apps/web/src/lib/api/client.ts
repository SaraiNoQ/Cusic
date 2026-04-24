import type { ApiSuccessEnvelope, AuthTokenPairDto } from '@music-ai/shared';
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from './auth-session';

type ApiFetchOptions = {
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
};

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/api/v1`;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await performFetch(path, init, options);

  if (
    response.status === 401 &&
    !options.skipAuth &&
    !options.skipAuthRefresh
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryResponse = await performFetch(path, init, options);
      if (retryResponse.ok) {
        return (await retryResponse.json()) as T;
      }
      throw new Error(`Request failed: ${retryResponse.status}`);
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function performFetch(
  path: string,
  init?: RequestInit,
  options: ApiFetchOptions = {},
) {
  const session = readAuthSession();

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(!options.skipAuth && session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function refreshAccessToken() {
  const session = readAuthSession();
  if (!session?.refreshToken) {
    clearAuthSession();
    return false;
  }

  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: session.refreshToken,
    }),
  });

  if (!response.ok) {
    clearAuthSession();
    return false;
  }

  const payload =
    (await response.json()) as ApiSuccessEnvelope<AuthTokenPairDto>;
  writeAuthSession({
    ...payload.data,
    user: session.user ?? undefined,
  });
  return true;
}
