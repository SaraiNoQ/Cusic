import type {
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  AuthTokenPairDto,
} from '@music-ai/shared';
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from './auth-session';

type ApiFetchOptions = {
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
};

function getClientTimezone() {
  if (typeof window === 'undefined') {
    return null;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone?.trim() ? timezone : null;
}

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001/api/v1`;
    }

    // Production: use relative path so Next.js rewrite proxy handles the
    // request server-side, avoiding cross-origin CORS issues entirely.
    return '/api/v1';
  }

  return 'http://localhost:3001/api/v1';
}

async function raiseForStatus(response: Response): Promise<never> {
  let body: ApiErrorEnvelope | Record<string, unknown> | undefined;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // body could not be parsed as JSON
    throw new Error(`Request failed: ${response.status}`);
  }

  if (
    body &&
    body.success === false &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'code' in (body.error as Record<string, unknown>) &&
    'message' in (body.error as Record<string, unknown>)
  ) {
    const err = body.error as { code: string; message: string };
    throw new Error(err.message);
  }

  throw new Error(`Request failed: ${response.status}`);
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
      await raiseForStatus(retryResponse);
    }
  }

  if (!response.ok) {
    await raiseForStatus(response);
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
      ...(getClientTimezone()
        ? { 'X-Cusic-Timezone': getClientTimezone()! }
        : {}),
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
