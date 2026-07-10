import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from './types';

/**
 * Axios client for the Go backend API.
 *
 * - Relative baseURL inherits the Vite dev proxy and production origin.
 * - JWT interceptor: attaches `Authorization: Bearer <hill_token>` from
 *   localStorage to every request.
 * - Error mapping: Go backend returns `{"code":400,"error":"ERR_CODE","message":"..."}`.
 */
export const http: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
  },
});

/* ----------------------------- JWT interceptor -------------------------- */

const TOKEN_KEY = 'hill_token';

http.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

/**
 * Like apiGet, but returns the response body directly without checking for
 * a `{code, data}` envelope. Use for endpoints that return bare JSON objects.
 */
export async function rawGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config);
  return data;
}

/**
 * Like apiPost, but returns the response body directly without checking for
 * a `{code, data}` envelope. Use for endpoints that return bare JSON objects.
 */
export async function rawPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<T>(url, body, config);
  return data;
}

/**
 * Like apiPut, but returns the response body directly without checking for
 * a `{code, data}` envelope.
 */
export async function rawPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.put<T>(url, body, config);
  return data;
}

/**
 * Like apiPatch, but returns the response body directly without checking for
 * a `{code, data}` envelope.
 */
export async function rawPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.patch<T>(url, body, config);
  return data;
}

/**
 * Like apiDelete, but returns the response body directly without checking for
 * a `{code, data}` envelope.
 */
export async function rawDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.delete<T>(url, config);
  return data;
}
