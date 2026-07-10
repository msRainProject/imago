import { apiGet, apiPatch, apiPut } from './client';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

/**
 * GET /api/auth/profile
 * Returns the calling user's profile.
 * Requires JWT auth.
 */
export function fetchProfile(): Promise<UserProfile> {
  return apiGet<UserProfile>('/api/auth/profile');
}

/**
 * PATCH /api/auth/profile
 * Updates the calling user's display_name. Username and role are immutable
 * for self-service profile updates; only display_name is accepted.
 * Requires JWT auth.
 */
export function updateProfile(data: { display_name: string }): Promise<UserProfile> {
  return apiPatch<UserProfile>('/api/auth/profile', data);
}

/**
 * PUT /api/auth/password
 * Rotates the calling user's password. The server validates the current
 * password before accepting the new one.
 * Requires JWT auth.
 */
export function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<{ message: string }> {
  return apiPut<{ message: string }>('/api/auth/password', data);
}
