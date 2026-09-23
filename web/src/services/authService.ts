import { fetchApi, setStoredToken, clearStoredToken } from '../api/apiClient';

export interface RequestOtpResponse {
  message: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  message: string;
  access_token: string;
}

export interface CurrentUser {
  id: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'ADMIN' | 'USER';
}

export async function login(email: string, password: string): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result.access_token) setStoredToken(result.access_token);
  return result;
}

export async function registerPortal(email: string, password: string, company?: string): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/portal/register', { method: 'POST', body: JSON.stringify({ email, password, company }) });
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
