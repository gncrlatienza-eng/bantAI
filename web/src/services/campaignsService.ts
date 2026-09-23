import { fetchApi } from '../api/apiClient';

export interface CampaignCluster {
  id: string;
  label?: string | null;
  centroid?: unknown;
  urlDomains: string[];
  isActive: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMessageSummary {
  id: string;
  body: string;
  receivedAt: string;
  classification?: {
    label: string;
    score: number;
    bucket?: string | null;
  } | null;
}

/*
 * The GET /campaigns/:id endpoint scopes messages to the requesting JWT user
 * (see backend CampaignsService.findOne). Admins therefore see only their own
 * view of a cluster's messages, not every user's messages in it.
 */
export interface CampaignDetail extends CampaignCluster {
  messages: CampaignMessageSummary[];
}

export async function getActiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns');
}

export async function getInactiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/inactive');
}

export async function getCampaignById(id: string): Promise<CampaignDetail> {
  return fetchApi<CampaignDetail>(`/campaigns/${id}`);
}

export async function deactivateCampaign(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}/deactivate`, {
    method: 'PATCH',
  });
}
