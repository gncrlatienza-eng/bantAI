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

export interface OrganizationAlertItem {
  id: string;
  status: string;
  createdAt: string;
  message: {
    id: string;
    receivedAt: string;
    classification?: {
      label: string;
      score: number;
      bucket?: string | null;
    } | null;
  };
}

export async function getOrganizationAlerts(
  organizationId: string,
): Promise<OrganizationAlertItem[]> {
  return fetchApi<OrganizationAlertItem[]>(
    `/portal-organizations/${organizationId}/alerts`,
  );
}
