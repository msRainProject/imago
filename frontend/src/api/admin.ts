import { apiGet, apiPut, rawGet, rawPost, rawPatch, rawDelete } from './client';
import type { AdminUser, AdminUserListResponse, AdminTokenListResponse, CreateTokenResponse, AppToken, CreateAppTokenResponse } from './types';

/* ----------------------------- Config ----------------------------------- */

export function fetchConfig(): Promise<Record<string, string>> {
  return apiGet<Record<string, string>>('/api/admin/config');
}

export function updateConfig(data: Record<string, string>): Promise<Record<string, string>> {
  return apiPut<Record<string, string>>('/api/admin/config', data);
}

/* ----------------------------- Tokens ----------------------------------- */

export function fetchTokens(): Promise<AdminTokenListResponse> {
  return rawGet<AdminTokenListResponse>('/api/admin/tokens');
}

export function createToken(name: string): Promise<CreateTokenResponse> {
  return rawPost<CreateTokenResponse>('/api/admin/tokens', { name });
}

export function deleteToken(id: string): Promise<{ deleted: boolean }> {
  return rawDelete<{ deleted: boolean }>(`/api/admin/tokens/${encodeURIComponent(id)}`);
}

/* ----------------------------- Users ------------------------------------ */

export function fetchUsers(): Promise<AdminUserListResponse> {
  return apiGet<AdminUserListResponse>('/api/admin/users');
}

export function createUser(data: { username: string; password: string; role: string }): Promise<AdminUser> {
  return rawPost<AdminUser>('/api/admin/users', data);
}

export function updateUser(id: string, data: Partial<{ username: string; password: string; role: string }>): Promise<AdminUser> {
  return rawPatch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, data);
}

export function deleteUser(id: string): Promise<{ deleted: boolean }> {
  return rawDelete<{ deleted: boolean }>(`/api/admin/users/${encodeURIComponent(id)}`);
}

/* ----------------------------- API Keys (App Tokens) -------------------- */

export function listAppTokens(): Promise<{ code: number; data: AppToken[] }> {
  return rawGet<{ code: number; data: AppToken[] }>('/api/admin/api-keys');
}

export function createAppToken(name: string): Promise<CreateAppTokenResponse> {
  return rawPost<CreateAppTokenResponse>('/api/admin/api-keys', { name });
}

export function deleteAppToken(id: string): Promise<{ deleted: boolean }> {
  return rawDelete<{ deleted: boolean }>(`/api/admin/api-keys/${encodeURIComponent(id)}`);
}
