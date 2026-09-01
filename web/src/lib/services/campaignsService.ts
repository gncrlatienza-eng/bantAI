import { fetchApi } from '../api';

export interface CampaignCluster {
  id: string;
  name: string;
  centroid: number[];
  discoveredDomains: string[];
  sampleMessages: string[];
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}

export async function getCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns', { useApiKey: false });
}

export async function getInactiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/inactive', {
    useApiKey: false,
  });
}

export async function getCampaign(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}`, { useApiKey: false });
}

export async function deactivateCampaign(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}/deactivate`, {
    method: 'PATCH',
    useApiKey: true,
  });
}
