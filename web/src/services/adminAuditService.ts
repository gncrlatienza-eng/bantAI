import { fetchApi } from '../api/apiClient';

export interface AdminAuditEvent {
  id: string;
  type: string;
  actorUserId: string | null;
  targetUserId: string | null;
  organizationId: string | null;
  accessRequestId: string | null;
  licenseId: string | null;
  createdAt: string;
}

/* Routine restricted-content reads are hidden unless asked for. */
export const getAdminAuditEvents = (includeReads = false) =>
  fetchApi<AdminAuditEvent[]>('/admin/audit-events', {
    params: includeReads ? { includeReads: 'true' } : undefined,
  });
