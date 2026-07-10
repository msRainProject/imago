import type { AuthUser } from '@api/types';

const TOKEN_KEY = 'hill_token';
const USER_KEY = 'hill_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): AuthUser | null {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
