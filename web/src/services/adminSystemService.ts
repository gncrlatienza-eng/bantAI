import { fetchApi } from '../api/apiClient';

export interface ApiLogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
}

export interface ApiLogResponse {
  retention: string;
  redaction: string;
  entries: ApiLogEntry[];
}

export interface DbStorageRows {
  users: number;
  organizations: number;
  messages: number;
  classifications: number;
  alerts: number;
  campaigns: number;
  reports: number;
  safetyTips: number;
}

export interface DbStorageResponse {
  measuredAt: string;
  databaseBytes: string;
  rows: DbStorageRows;
}

export function getAdminApiLogs(): Promise<ApiLogResponse> {
  return fetchApi<ApiLogResponse>('/admin/api-logs');
}

export function getAdminDbStorage(): Promise<DbStorageResponse> {
  return fetchApi<DbStorageResponse>('/admin/db-storage');
}
