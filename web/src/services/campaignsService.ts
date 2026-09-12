import { fetchApi } from '../api/apiClient';

export interface CampaignCluster {
  id: string;
  label?: string | null;
  centroid?: any;
  urlDomains: string[];
  isActive: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages?: any[];
}

export async function getActiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns');
}

export async function getInactiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/inactive');
}

export async function getCampaignById(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}`);
}

export async function deactivateCampaign(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}/deactivate`, {
    method: 'PATCH',
    useApiKey: true,
  });
}
