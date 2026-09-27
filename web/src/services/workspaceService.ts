import { fetchApi } from '../api/apiClient';

export interface WorkspaceMember {
  id: string;
  userId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role: 'TIER_1' | 'TIER_2';
  isOwner: boolean;
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: 'TIER_1' | 'TIER_2';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceOrganization {
  id: string;
  name: string;
  ownerId?: string | null;
  isOwner: boolean;
  myRole: 'TIER_1' | 'TIER_2';
  seatLimit: number;
  seatsUsed: number;
  license: {
    tier: 'RESEARCH' | 'ORGANIZATION';
    status: string;
    billingPeriod: string;
    expiresAt?: string | null;
  };
}

export interface WorkspaceDetailsResponse {
  organization: WorkspaceOrganization;
  members: WorkspaceMember[];
  pendingInvitations: WorkspaceInvitation[];
}

export interface LicenseDetailsResponse {
  tier: 'RESEARCH' | 'ORGANIZATION';
  status: string;
  seatLimit: number;
  seatsUsed: number;
  seatsRemaining: number;
  billingPeriod: string;
  activatedAt: string;
  expiresAt?: string | null;
}

export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
}

export interface BillingDetailsResponse {
  currentPlan: string;
  status: string;
  billingPeriod: string;
  nextBillingDate?: string | null;
  stripeCustomerId?: string | null;
  invoices: BillingInvoice[];
}

export async function getMyWorkspace(): Promise<WorkspaceDetailsResponse> {
  return fetchApi<WorkspaceDetailsResponse>('/portal-organizations/me');
}

export async function inviteWorkspaceMember(dto: {
  email: string;
  role: 'TIER_1' | 'TIER_2';
}): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/portal-organizations/me/invitations', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function revokeWorkspaceInvitation(
  invitationId: string,
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(
    `/portal-organizations/me/invitations/${invitationId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function removeWorkspaceMember(
  userId: string,
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(
    `/portal-organizations/me/members/${userId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function transferWorkspaceOwnership(
  targetUserId: string,
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(
    '/portal-organizations/me/transfer-ownership',
    {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    },
  );
}

export async function getWorkspaceLicense(): Promise<LicenseDetailsResponse> {
  return fetchApi<LicenseDetailsResponse>('/portal-organizations/me/license');
}

export async function getWorkspaceBilling(): Promise<BillingDetailsResponse> {
  return fetchApi<BillingDetailsResponse>('/portal-organizations/me/billing');
}
