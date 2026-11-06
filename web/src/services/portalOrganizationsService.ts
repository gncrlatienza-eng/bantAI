import { fetchApi } from '../api/apiClient';

export interface PortalOrganizationItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count: { members: number };
}

export async function getPortalOrganizations(): Promise<
  PortalOrganizationItem[]
> {
  return fetchApi<PortalOrganizationItem[]>('/portal-organizations');
}
