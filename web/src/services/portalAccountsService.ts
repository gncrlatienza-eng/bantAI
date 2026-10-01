import { fetchApi } from '../api/apiClient';

export type PortalAccessStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type PortalAccountAction = 'suspend' | 'restore' | 'revoke';

export interface PortalAccountUser {
  id: string;
  email: string | null;
  company: string | null;
  portalAccessStatus: PortalAccessStatus;
  portalAccessReason: string | null;
  portalAccessUpdatedAt: string | null;
  portalAccessUpdatedBy: string | null;
}

export interface AdministrativePortalOrganization {
  id: string;
  name: string;
  isActive: boolean;
  shieldLicensed: boolean;
  createdAt: string;
  licensedAccessRequest: {
    id: string;
    referenceNumber: number;
    tier: 'SHIELD';
    status: string;
    email: string;
    activatedAt: string | null;
  } | null;
  licenses: Array<{
    id: string;
    tier: 'SHIELD';
    status: string;
    legacyTier: string | null;
    shieldReviewDecision: 'PENDING' | 'APPROVED' | 'REJECTED';
    billingPeriod: 'MONTHLY' | 'ANNUAL';
    validFrom: string;
    validUntil: string | null;
  }>;
  members: Array<{
    id: string;
    role: 'SHIELD';
    createdAt: string;
    user: PortalAccountUser;
  }>;
}

export interface PortalAccountActionResponse {
  user: PortalAccountUser;
  audit: {
    id: string;
    action: Uppercase<PortalAccountAction>;
    previousStatus: PortalAccessStatus;
    newStatus: PortalAccessStatus;
    reason: string;
    createdAt: string;
  };
}

export function getAdministrativePortalAccounts() {
  return fetchApi<AdministrativePortalOrganization[]>('/admin/portal-accounts');
}

export function takePortalAccountAction(
  userId: string,
  action: PortalAccountAction,
  reason: string,
) {
  return fetchApi<PortalAccountActionResponse>(
    `/admin/portal-accounts/${encodeURIComponent(userId)}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export interface LegacyLicenseReview {
  id: string;
  organizationId: string;
  accessRequestId: string;
  legacyTier: string;
  status: string;
  validFrom: string;
  validUntil: string | null;
  shieldReviewDecision: 'PENDING' | 'APPROVED' | 'REJECTED';
  shieldReviewedAt: string | null;
  shieldReviewedByUserId: string | null;
  shieldReviewReason: string | null;
  shieldApprovedAt: string | null;
  /* Who the license belongs to, so a review cannot target the wrong account. */
  organizationName: string;
  accountEmail: string;
  applicantName: string;
  requestReference: string;
}

export function getLegacyLicenseReviews() {
  return fetchApi<LegacyLicenseReview[]>(
    '/admin/portal-accounts/licenses/legacy-review',
  );
}

export function reviewLegacyLicense(
  licenseId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
  evidenceReference: string,
) {
  return fetchApi(
    `/admin/portal-accounts/licenses/${encodeURIComponent(licenseId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, reason, evidenceReference }),
    },
  );
}
