import { apiGet, apiDelete, apiPatch, apiPost } from './client';
import type { FileListResponse, ImageItem, ListFilesParams, UploadResponse } from './types';

/**
 * GET /api/files
 * List files with pagination, search, and sort.
 * Requires JWT auth.
 */
export function listFiles(params: ListFilesParams = {}): Promise<FileListResponse> {
  return apiGet<FileListResponse>('/api/files', { params });
}

/**
 * GET /api/files/:hash
 * Get a single file's metadata.
 * Requires JWT auth.
 */
export function getFile(hash: string): Promise<ImageItem> {
  return apiGet<ImageItem>(`/api/files/${encodeURIComponent(hash)}`);
}

/**
 * DELETE /api/files/:hash
 * Delete a single file by hash.
 * Requires JWT auth.
 */
export function deleteFile(hash: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/api/files/${encodeURIComponent(hash)}`);
}

/**
 * POST /api/files/batch_delete
 * Delete multiple files by hash.
 * Requires JWT auth.
 */
export function batchDeleteFiles(hashes: string[]): Promise<{ deleted: number }> {
  return apiPost<{ deleted: number }>('/api/files/batch_delete', { hashes });
}

/**
 * PATCH /api/files/:hash
 * Rename a file.
 * Requires JWT auth.
 */
export function renameFile(hash: string, name: string): Promise<ImageItem> {
  return apiPatch<ImageItem>(`/api/files/${encodeURIComponent(hash)}`, { name });
}

/**
 * POST /api/upload
 * Multipart upload of a single file.
 * Supports JWT auth OR X-API-Token header.
 * Returns UploadResponse with hash, url, size, width, height.
 */
export async function uploadFile(
  file: File,
  opts?: {
    apiToken?: string;
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  },
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);

  // Use XHR for accurate upload progress on large files.
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.responseType = 'json';

    // Session cookie is sent via withCredentials. API token is optional for scripts.
    xhr.withCredentials = true;
    if (opts?.apiToken) {
      xhr.setRequestHeader('X-API-Token', opts.apiToken);
    }
    // CSRF double-submit for cookie-authenticated browser uploads.
    try {
      const match = document.cookie.match(/(?:^|; )hill_csrf=([^;]*)/);
      if (match) {
        xhr.setRequestHeader('X-CSRF-Token', decodeURIComponent(match[1]));
      }
    } catch {
      /* ignore */
    }

    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && opts?.onProgress) {
        opts.onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const body = xhr.response;
        if (body && body.code === 200) {
          resolve(body.data as UploadResponse);
        } else {
          reject(new Error(body?.message ?? `Upload failed (${xhr.status})`));
        }
      } else {
        const body = xhr.response;
        reject(new Error(body?.message ?? `Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload aborted', 'AbortError')));
    xhr.send(form);
  });
}
