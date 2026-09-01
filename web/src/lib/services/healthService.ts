import { fetchApi } from '../api';

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime?: number;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/health', { useApiKey: false });
}
