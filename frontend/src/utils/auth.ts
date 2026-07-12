import type { AuthUser } from '@api/types';

const USER_KEY = 'hill_user';
const AUTH_FLAG = 'hill_auth';
/** @deprecated legacy localStorage JWT key — cleared on load. */
const LEGACY_TOKEN_KEY = 'hill_token';

function clearLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Called once at app boot to migrate away from localStorage JWTs. */
export function migrateAuthStorage(): void {
  clearLegacyToken();
}

export function getToken(): string | null {
  // Tokens live in HttpOnly cookies now. Keep the helper so older call sites
  // compile; always return null so they do not send a stale Bearer header.
  clearLegacyToken();
  return null;
}

export function setToken(_token: string): void {
  // No-op: JWT is stored in the HttpOnly hill_session cookie by the server.
  clearLegacyToken();
  localStorage.setItem(AUTH_FLAG, '1');
}

export function getUser(): AuthUser | null {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_FLAG, '1');
  clearLegacyToken();
}

export function clearAuth(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(AUTH_FLAG);
  clearLegacyToken();
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin';
}

export function isAuthenticated(): boolean {
  // Cookie is HttpOnly so JS cannot read it. We treat a stored user / auth flag
  // as the client-side session hint; 401 responses clear it.
  if (localStorage.getItem(AUTH_FLAG) === '1') return true;
  return !!getUser();
}

/** Read a non-HttpOnly cookie (used for the CSRF double-submit token). */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function getCsrfToken(): string | null {
  return getCookie('hill_csrf');
}
