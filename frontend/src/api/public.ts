import { apiGet } from './client';
import type { StatsResponse, UploadClientConfig } from './types';

/**
 * GET /api/stats
 * Fetch public usage statistics (no auth required).
 */
export function fetchStats(): Promise<StatsResponse> {
  return apiGet<StatsResponse>('/api/stats');
}

/**
 * GET /api/upload/options
 * Fetch public client-side upload processing settings.
 */
export function fetchUploadOptions(): Promise<UploadClientConfig> {
  return apiGet<UploadClientConfig>('/api/upload/options');
}

/** @deprecated Use fetchStats() instead. */
export const fetchPublicStats = fetchStats;
