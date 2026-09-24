import { fetchApi, setStoredToken, clearStoredToken } from '../api/apiClient';

export interface RequestOtpResponse {
  message: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  message: string;
  access_token: string;
}

export type LicenseTier = 'Research' | 'Organization';
export type WorkspaceMembership = 'Owner' | 'Member';
export type AccountStatus = 'Active' | 'Pending Confirmation' | 'Under Review';

export type StaffRole =
  'SUPERADMIN' | 'SUPPORT' | 'ANALYST' | 'OPERATIONS' | 'PRIVACY';

export interface CurrentUser {
  id: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'ADMIN' | 'USER';
  staffRole?: StaffRole | null;
  permissions?: string[];
  // Workspace & Tenancy Metadata
  workspaceName?: string | null;
  licenseTier?: LicenseTier | null;
  membership?: WorkspaceMembership | null;
  status?: AccountStatus | null;
}

export interface CustomerMetadata {
  workspace: string;
  license: LicenseTier;
  membership: WorkspaceMembership;
  status: AccountStatus;
}

export function getCustomerMetadata(
  user: CurrentUser | null,
): CustomerMetadata {
  if (!user) {
    return {
      workspace: 'Workspace',
      license: 'Research',
      membership: 'Member',
      status: 'Active',
    };
  }

  const workspace =
    user.company?.trim() || user.workspaceName || 'Primary Workspace';
  const license: LicenseTier =
    user.licenseTier || (user.company ? 'Organization' : 'Research');
  const membership: WorkspaceMembership =
    user.membership || (user.role === 'ADMIN' ? 'Owner' : 'Member');
  const status: AccountStatus = user.status || 'Active';

  return { workspace, license, membership, status };
}

export interface UserEntitlements {
  canViewThreatIntel: boolean;
  canTriageAlerts: boolean;
  canExportData: boolean;
  canManageWorkspace: boolean;
  licenseTier: LicenseTier;
}

export function getUserEntitlements(
  user: CurrentUser | null,
): UserEntitlements {
  const { license, membership } = getCustomerMetadata(user);
  const isOrg = license === 'Organization';
  const isOwner = membership === 'Owner';

  return {
    canViewThreatIntel: true,
    canTriageAlerts: true,
    canExportData: isOrg,
    canManageWorkspace: isOrg && isOwner,
    licenseTier: license,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (result.access_token) setStoredToken(result.access_token);
  return result;
}

export async function clientLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: CurrentUser }> {
  const result = await login(email, password);
  const user = await getCurrentUser();
  return { token: result.access_token, user };
}

export interface StaffAuthResponse {
  message: string;
  requiresMfa?: boolean;
  access_token?: string;
  email?: string;
}

export const staffMfaConfig = {
  requestStaffMfa: async (email: string): Promise<RequestOtpResponse> => {
    return fetchApi<RequestOtpResponse>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

export async function requestStaffMfa(
  email: string,
): Promise<RequestOtpResponse> {
  return staffMfaConfig.requestStaffMfa(email);
}

export async function adminAuthenticateStaff(
  email: string,
  password: string,
): Promise<{ user?: CurrentUser; email: string; requiresMfa: boolean }> {
  // Step 1 of Admin Login: Verify staff credentials
  // Ensure no stale or pre-MFA token is stored in localStorage
  clearStoredToken();

  const result = await fetchApi<StaffAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Enforce customer account blocking:
  // If /auth/login returns a standard user session without requiring MFA,
  // customer accounts CANNOT complete Admin login.
  if (!result.requiresMfa) {
    logout();
    throw new Error(
      'Access denied: Customer accounts cannot sign in to the Internal Admin portal. Please use the Client Portal.',
    );
  }

  // CRITICAL: Ensure no access_token is stored before server-side MFA verification succeeds!
  clearStoredToken();

  // Dispatch staff MFA to staff Gmail/email address
  // Fail-closed requirement: If OTP delivery fails, the authentication flow must NOT proceed as authenticated!
  await staffMfaConfig.requestStaffMfa(email);

  return { email, requiresMfa: true };
}

export async function adminVerifyMfa(
  emailOrIdentifier: string,
  mfaCode: string,
): Promise<{ token: string; user: CurrentUser }> {
  // Step 2 of Admin Login: Verify MFA challenge
  // Ensure no stale token is active
  clearStoredToken();

  let result: VerifyOtpResponse;
  if (emailOrIdentifier && emailOrIdentifier.startsWith('+')) {
    result = await verifyOtp(emailOrIdentifier, mfaCode);
  } else {
    // Staff MFA verification using staff email/Gmail identifier
    result = await fetchApi<VerifyOtpResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: emailOrIdentifier, otp: mfaCode }),
    });
  }

  if (!result?.access_token) {
    logout();
    throw new Error('MFA verification failed: No access token issued.');
  }

  // ONLY after server-side MFA verification succeeds do we persist the privileged session!
  setStoredToken(result.access_token);

  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') {
    logout();
    throw new Error(
      'Access denied: This account does not have staff or administrator privileges.',
    );
  }

  return { token: result.access_token, user };
}

export async function registerPortal(
  email: string,
  password: string,
  company?: string,
): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/portal/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, company }),
  });
  if (result.access_token) setStoredToken(result.access_token);
  return result;
}

export async function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return fetchApi<RequestOtpResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp: code }),
  });
  if (result.access_token) {
    setStoredToken(result.access_token);
  }
  return result;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchApi<CurrentUser>('/auth/me');
}

export function logout() {
  clearStoredToken();
  localStorage.removeItem('bantai_session');
}

/*
 * Access-request licensing tiers. The names match the backend contract we
 * expect: two licenses (research, organization), reviewed manually before
 * anything downstream (proposal, invoice, Stripe checkout) is offered.
 */
export type AccessRequestTier = 'research' | 'organization';

export interface AccessRequestPayload {
  tier: AccessRequestTier;
  fullName: string;
  email: string;
  organization: string;
  intendedUse: string;
  reason: string;
}

export interface AccessRequestResponse {
  id: string;
  tier: AccessRequestTier;
  status: 'received' | 'under_review';
  submittedAt: string;
}

/*
 * Submits a licensing access request. There is intentionally no simulated
 * success path: if the backend endpoint is not deployed yet, fetchApi throws
 * and the UI shows a real error.
 */
export async function submitAccessRequest(
  payload: AccessRequestPayload,
): Promise<AccessRequestResponse> {
  return fetchApi<AccessRequestResponse>('/access-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type BillingPeriod = 'MONTHLY' | 'ANNUAL';

export interface ApprovedAccessRequest {
  id: string;
  tier: AccessRequestTier;
  status: string;
  fullName: string;
  email: string;
  organization: string;
  billingPeriod: BillingPeriod | null;
  approvedAt: string | null;
  activatedAt: string | null;
}

/*
 * Fetches the approved-request summary keyed by the emailed approval token.
 * Used on the confirmation-before-Stripe page. Access is not granted here;
 * this is just enough context to render the "Continue to secure payment"
 * screen.
 */
export async function getAccessRequestByToken(
  token: string,
): Promise<ApprovedAccessRequest> {
  const params = new URLSearchParams({ token }).toString();
  return fetchApi<ApprovedAccessRequest>(`/access-requests/by-token?${params}`);
}

/*
 * Asks the backend to create a Stripe Checkout Session for the selected
 * billing period. Returns the hosted checkout URL, which the caller
 * navigates to. Access is *not* granted by reaching Stripe's success URL —
 * the backend's Stripe webhook is the only signal that activates a license.
 */
export async function createCheckoutSession(
  token: string,
  billingPeriod: BillingPeriod,
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>('/payments/checkout-session', {
    method: 'POST',
    body: JSON.stringify({ token, billingPeriod }),
  });
}
