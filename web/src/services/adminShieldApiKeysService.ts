import { fetchApi } from '../api/apiClient';
import type { ShieldApiKey } from './shieldApiKeysService';

export interface AdminShieldApiKey extends ShieldApiKey {
  organizationId: string;
  organization: { name: string; isActive: boolean };
}

export interface AdminShieldUsage {
  requestsThisPeriod: number;
  byOrganization: { organizationId: string; requests: number }[];
  recent: {
    organizationId: string;
    keyId: string;
    route: string;
    method: string;
    statusCode: number | null;
    createdAt: string;
  }[];
}

export interface AdminShieldOrganization {
  id: string;
  name: string;
  isActive: boolean;
  apiMonthlyQuota: number;
  apiRateLimitPerMinute: number;
}

export const listAdminShieldApiKeys = () =>
  fetchApi<AdminShieldApiKey[]>('/admin/shield-api-keys');
export const getAdminShieldUsage = () =>
  fetchApi<AdminShieldUsage>('/admin/shield-api-keys/usage');
export const listAdminShieldOrganizations = () =>
  fetchApi<AdminShieldOrganization[]>('/admin/shield-api-keys/organizations');
export const revokeAdminShieldApiKey = (keyId: string) =>
  fetchApi<AdminShieldApiKey>(
    `/admin/shield-api-keys/${encodeURIComponent(keyId)}`,
    { method: 'DELETE' },
  );
export const updateAdminShieldApiLimits = (
  organizationId: string,
  monthlyQuota: number,
  rateLimitPerMinute: number,
) =>
  fetchApi<
    Pick<
      AdminShieldOrganization,
      'id' | 'apiMonthlyQuota' | 'apiRateLimitPerMinute'
    >
  >(
    '/admin/shield-api-keys/organizations/' +
      encodeURIComponent(organizationId) +
      '/limits',
    {
      method: 'PATCH',
      body: JSON.stringify({ monthlyQuota, rateLimitPerMinute }),
    },
  );
