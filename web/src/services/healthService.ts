import { fetchApi } from '../api/apiClient';

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export interface ReadinessStatus {
  status: string;
  database: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  return fetchApi<HealthStatus>('/health');
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  return fetchApi<ReadinessStatus>('/health/ready');
}
