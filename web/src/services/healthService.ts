import { fetchApi } from '../api/apiClient';

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  return fetchApi<HealthStatus>('/health');
}
