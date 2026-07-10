/**
 * Hill Images — typed domain models.
 *
 * These mirror the JSON shapes returned by the Go backend.
 * All successful responses follow: `{ code: number, data: T }`
 * Error responses follow: `{ code: number, error: string, message: string }`
 */

/* ----------------------------- Envelope --------------------------------- */

export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export interface ApiError {
  code: number;
  error: string;
  message: string;
}

/* ------------------------------- Auth ----------------------------------- */

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface WebAuthnChallengeResponse {
  session_key: string;
  options: PublicKeyCredentialRequestOptions;
}

export interface WebAuthnVerifyResponse {
  token?: string;
  user?: AuthUser;
  registered?: boolean;
}

export interface PasskeyCredential {
  credential_id: string;
  friendly_name: string;
  created_at: number;
  last_used_at: number;
}

/* ------------------------------- Stats ---------------------------------- */

export interface StatsResponse {
  total_images: number;
  total_size: number;
  total_users: number;
}

/* ------------------------------- Files ---------------------------------- */

export interface ImageItem {
  id: string;
  hash: string;
  name: string;
  original_name?: string;
  mime_type?: string;
  url: string;
  size: number;
  width: number;
  height: number;
  uploaded_at: string;
}

export interface FileListResponse {
  data: ImageItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadResponse {
  hash: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

export interface UploadClientConfig {
  enabled: boolean;
  target_format: 'original' | 'jpeg' | 'png' | 'webp';
  max_size_mb: number;
  max_width: number;
  max_height: number;
  max_upload_mb: number;
  allowed_ext: string;
}

export interface ListFilesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
}

/* ------------------------------- Admin ---------------------------------- */

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface AdminUserListResponse {
  data: AdminUser[];
  total: number;
}

export interface AdminToken {
  id: string;
  name: string;
  last_used: string;
  created_at: string;
}

export interface AdminTokenListResponse {
  data: AdminToken[];
  total: number;
}

export interface CreateTokenResponse {
  token: string;
  name: string;
  id: string;
}

/* ------------------------- Legacy compat aliases ------------------------ */
/** @deprecated Use ImageItem instead. Kept for gradual migration. */
export type FileEntry = ImageItem;
/** @deprecated Use StatsResponse instead. */
export type PublicStats = StatsResponse;
/** @deprecated Use UploadResponse instead. */
export type UploadResult = UploadResponse;

/* ------------------------------- API Keys (App Tokens) ------------------ */

export interface AppToken {
  id: string;
  name: string;
  is_active: boolean;
  upload_count: number;
  upload_total_bytes: number;
  last_used: string | null;
  created_at: string;
}

export interface CreateAppTokenResponse {
  id: string;
  name: string;
  api_token: string;
}
