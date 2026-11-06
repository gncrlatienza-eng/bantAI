import { fetchApi } from '../api/apiClient';

export type ShieldApiScope =
  | 'READ_CAMPAIGNS'
  | 'READ_INDICATORS'
  | 'READ_MASKED_MESSAGES'
  | 'EXPORT_CAMPAIGNS';
export interface ShieldApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keySuffix: string;
  scopes: ShieldApiScope[];
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}
const path = (organizationId: string) =>
  `/shield/organizations/${encodeURIComponent(organizationId)}/api-keys`;
export const listShieldApiKeys = (organizationId: string) =>
  fetchApi<ShieldApiKey[]>(path(organizationId));
export interface ShieldApiUsage {
  requestsToday: number;
  requestsThisPeriod: number;
  monthlyQuota: number;
  rateLimitPerKeyPerMinute: number;
  recentSuccessRate: number | null;
  recent: {
    keyId: string;
    route: string;
    method: string;
    statusCode: number | null;
    createdAt: string;
  }[];
}
export const getShieldApiUsage = (organizationId: string) =>
  fetchApi<ShieldApiUsage>(`${path(organizationId)}/usage`);
export const createShieldApiKey = (
  organizationId: string,
  name: string,
  scopes: ShieldApiScope[],
) =>
  fetchApi<ShieldApiKey & { secret: string }>(path(organizationId), {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  });
export const rotateShieldApiKey = (organizationId: string, keyId: string) =>
  fetchApi<ShieldApiKey & { secret: string }>(
    `${path(organizationId)}/${encodeURIComponent(keyId)}/rotate`,
    { method: 'POST' },
  );
export const revokeShieldApiKey = (organizationId: string, keyId: string) =>
  fetchApi<ShieldApiKey>(
    `${path(organizationId)}/${encodeURIComponent(keyId)}`,
    { method: 'DELETE' },
  );
