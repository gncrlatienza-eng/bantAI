import { fetchApi } from '../api/apiClient';

export type AccessRequestTier = 'SHIELD';
export type AccessRequestStatus =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'MORE_INFO_REQUIRED'
  | 'APPROVED'
  | 'AGREEMENT_ACCEPTED'
  | 'DECLINED'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'SUPERSEDED';

export interface AdminAccessRequest {
  id: string;
  reference: string;
  tier: AccessRequestTier;
  status: AccessRequestStatus;
  fullName: string;
  email: string;
  organization: string;
  applicantRole: string | null;
  intendedUse: string;
  reason: string;
  expectedUsers: number | null;
  /* Tier-specific answers (department, website, deployment, …). */
  details: Record<string, string | boolean | undefined> | null;
  pilotInterest: boolean;
  productUpdatesOptIn: boolean;
  infoRequestedAt: string | null;
  infoRequestMessage: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  declinedReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledReason: string | null;
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
  billingPeriod: 'MONTHLY' | 'ANNUAL' | null;
  activatedAt: string | null;
  submittedAt: string;
  /* Account-first lifecycle: request owner and history link. */
  hasAccount?: boolean;
  previousAccessRequestId?: string | null;
  returningApplicant?: boolean;
  withdrawnAt?: string | null;
  emailDeliveries: Array<{
    kind: 'SUBMISSION' | 'APPROVAL' | 'ACTIVATION';
    status: 'ACCEPTED' | 'FAILED';
    attempts: number;
    lastAttemptAt: string;
    lastAcceptedAt: string | null;
    errorCode: string | null;
  }>;
}

export interface ApprovalResult {
  request: AdminAccessRequest;
  emailDelivery: {
    status: 'sent' | 'failed';
    to: string;
  };
}

export interface ApplicantHistory {
  returningApplicant: boolean;
  requests: Array<{
    id: string;
    reference: string;
    tier: AccessRequestTier;
    status: AccessRequestStatus;
    organization: string;
    submittedAt: string;
    declinedAt: string | null;
    activatedAt: string | null;
    license: {
      tier: AccessRequestTier;
      status: string;
      validFrom: string;
      validUntil: string | null;
    } | null;
  }>;
}

export function getAccessRequest(
  id: string,
): Promise<AdminAccessRequest & { applicantHistory: ApplicantHistory }> {
  return fetchApi(`/admin/access-requests/${encodeURIComponent(id)}`);
}

export function getAccessRequests(
  status?: AccessRequestStatus,
): Promise<AdminAccessRequest[]> {
  return fetchApi<AdminAccessRequest[]>('/admin/access-requests', {
    params: status ? { status } : undefined,
  });
}

export function startAccessRequestReview(
  id: string,
): Promise<AdminAccessRequest> {
  return fetchApi<AdminAccessRequest>(
    `/admin/access-requests/${id}/start-review`,
    { method: 'POST' },
  );
}

export function requestAccessRequestInfo(
  id: string,
  message: string,
): Promise<AdminAccessRequest> {
  return fetchApi<AdminAccessRequest>(
    `/admin/access-requests/${id}/request-info`,
    { method: 'POST', body: JSON.stringify({ message: message.trim() }) },
  );
}

export function approveAccessRequest(id: string): Promise<ApprovalResult> {
  return fetchApi<ApprovalResult>(`/admin/access-requests/${id}/approve`, {
    method: 'POST',
  });
}

export function resendApprovalEmail(id: string): Promise<ApprovalResult> {
  return fetchApi<ApprovalResult>(
    `/admin/access-requests/${id}/resend-approval-email`,
    { method: 'POST' },
  );
}

export function resendActivationEmail(
  id: string,
): Promise<ApprovalResult['emailDelivery']> {
  return fetchApi<ApprovalResult['emailDelivery']>(
    `/admin/access-requests/${id}/resend-activation-email`,
    { method: 'POST' },
  );
}

export function declineAccessRequest(
  id: string,
  reason?: string,
): Promise<AdminAccessRequest> {
  return fetchApi<AdminAccessRequest>(`/admin/access-requests/${id}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
  });
}

export function reconcileAccessRequestPayment(
  id: string,
): Promise<{ status: 'active'; message: string }> {
  return fetchApi<{ status: 'active'; message: string }>(
    `/admin/access-requests/${id}/reconcile-payment`,
    { method: 'POST' },
  );
}

export function cancelAccessRequest(
  id: string,
  reason: string,
): Promise<AdminAccessRequest> {
  return fetchApi<AdminAccessRequest>(`/admin/access-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason.trim() }),
  });
}

export function deleteAccessRequest(
  id: string,
  reason: string,
): Promise<{ deleted: true; id: string; reference: string }> {
  return fetchApi<{ deleted: true; id: string; reference: string }>(
    `/admin/access-requests/${id}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ reason: reason.trim() }),
    },
  );
}
