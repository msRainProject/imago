import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from './types';
import { clearAuth, getCsrfToken } from '@/utils/auth';

/**
 * Axios client for the Go backend API.
 *
 * - Relative baseURL inherits the Vite dev proxy and production origin.
 * - Session auth: HttpOnly `hill_session` cookie (withCredentials).
 * - CSRF: double-submit `hill_csrf` cookie → `X-CSRF-Token` header on mutations.
 * - Error mapping: Go backend returns `{"code":400,"error":"ERR_CODE","message":"..."}`.
 */
export const http: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

/* ----------------------------- CSRF interceptor ------------------------- */

http.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = getCsrfToken();
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

/* ----------------------------- Error mapping ---------------------------- */

export class HttpError extends Error {
  readonly status: number;
  readonly code: number;
  readonly error_code: string;
  readonly payload: unknown;

  constructor(message: string, status: number, code: number, error_code: string, payload: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.error_code = error_code;
    this.payload = payload;
  }
}

http.interceptors.response.use(
  (resp) => resp,
  (err: AxiosError<ApiError>) => {
    if (err.response) {
      const { status, data } = err.response;
      if (status === 401) {
        clearAuth();
      }
      const message = data?.message ?? err.message ?? 'Request failed';
      const code = data?.code ?? status;
      const error_code = data?.error ?? '';
      return Promise.reject(new HttpError(message, status, code, error_code, data));
    }
    if (err.request) {
      return Promise.reject(new HttpError('Network error', 0, 0, '', null));
    }
    return Promise.reject(new HttpError(err.message ?? 'Unknown error', 0, 0, '', null));
  },
);

/* ------------------------------ Helpers --------------------------------- */

/** Type-safe wrapper for endpoints that return `{ code, data }`. */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<ApiResponse<T>>(url, config);
  if (data.code !== 200) {
    throw new HttpError(
      (data as unknown as ApiError).message ?? 'Request failed',
      200,
      data.code,
      (data as unknown as ApiError).error ?? '',
      data,
    );
  }
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<ApiResponse<T>>(url, body, config);
  if (data.code !== 200 && data.code !== 201) {
    throw new HttpError(
      (data as unknown as ApiError).message ?? 'Request failed',
      200,
      data.code,
      (data as unknown as ApiError).error ?? '',
      data,
    );
  }
  return data.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.delete<ApiResponse<T>>(url, config);
  if (data.code !== 200) {
    throw new HttpError(
      (data as unknown as ApiError).message ?? 'Request failed',
      200,
      data.code,
      (data as unknown as ApiError).error ?? '',
      data,
    );
  }
  return data.data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.put<ApiResponse<T>>(url, body, config);
  if (data.code !== 200) {
    throw new HttpError(
      (data as unknown as ApiError).message ?? 'Request failed',
      200,
      data.code,
      (data as unknown as ApiError).error ?? '',
      data,
    );
  }
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.patch<ApiResponse<T>>(url, body, config);
  if (data.code !== 200) {
    throw new HttpError(
      (data as unknown as ApiError).message ?? 'Request failed',
      200,
      data.code,
      (data as unknown as ApiError).error ?? '',
      data,
    );
  }
  return data.data;
}

/* --------------------- Raw helpers (no envelope expected) ---------------- */

export async function rawGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config);
  return data;
}

export async function rawPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<T>(url, body, config);
  return data;
}

export async function rawPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.put<T>(url, body, config);
  return data;
}

export async function rawPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.patch<T>(url, body, config);
  return data;
}

export async function rawDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.delete<T>(url, config);
  return data;
}
