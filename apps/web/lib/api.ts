'use client';

/**
 * LAHANS Connect API client.
 *
 * Thin fetch wrapper that:
 *  - attaches the access token from localStorage
 *  - on 401, tries once to rotate via POST /auth/refresh, then retries
 *  - parses the BRD 7.4 error envelope { error: { code, message, details } }
 *  - never caches (BRD 7.4: no client-side sensitive caching)
 */

const TOKEN_KEY = 'lahans.access_token';
const REFRESH_KEY = 'lahans.refresh_token';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(pair: TokenPair): void {
  localStorage.setItem(TOKEN_KEY, pair.accessToken);
  localStorage.setItem(REFRESH_KEY, pair.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccess(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const pair = (await res.json()) as TokenPair;
    setTokens(pair);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init;

  const doFetch = (): Promise<Response> => {
    const token = auth ? getAccessToken() : null;
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined),
    };
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
    return fetch(path, { ...rest, headers: finalHeaders });
  };

  let res = await doFetch();

  // Single rotation attempt on 401 (BRD 7.4 token rotation).
  if (res.status === 401 && auth) {
    const ok = await refreshAccess();
    if (ok) res = await doFetch();
  }

  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = `Permintaan gagal (${res.status}).`;
    let details: unknown;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        details = body.error.details;
      }
    } catch {
      // non-JSON error body — keep defaults
    }
    throw new ApiError(res.status, code, message, details);
  }

  return (await res.json()) as T;
}