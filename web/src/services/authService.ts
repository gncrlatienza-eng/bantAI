import { clearLegacyStoredToken, fetchApi } from '../api/apiClient';

export interface RequestOtpResponse {
  message: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  message: string;
  access_token: string;
}

export interface CheckoutReconciliationResponse {
  status: 'active' | 'pending';
  message?: string;
}

/**
 * In non-production test mode the server may verify a completed Checkout
 * Session directly when a local Stripe webhook is unavailable. This endpoint
 * still validates the session server-side; a success URL is never proof of
 * payment on its own.
 */
export async function reconcileTestCheckout(
  checkoutSessionId: string,
): Promise<CheckoutReconciliationResponse> {
  return fetchApi<CheckoutReconciliationResponse>(
    '/payments/test/reconcile-checkout',
    {
      method: 'POST',
      body: JSON.stringify({ checkoutSessionId }),
    },
  );
}

export interface CurrentUser {
  id: string;
  /* Null for email-only portal accounts. */
  phone: string | null;
  email?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'ADMIN' | 'USER';
  /** Present for staff sessions; server authorization remains authoritative. */
  staffRole?: string | null;
  /** A display hint for staff screens, never a substitute for backend guards. */
  permissions?: string[];
}

/*
 * Account-first registration. Step 1 sends a code only when no account uses
 * the email yet; an existing account returns a conflict so the UI can direct
 * the user to sign in. Step 2 proves the email, sets the password, and starts
 * a session (HttpOnly cookie).
 */
export async function requestSignUpOtp(
  email: string,
): Promise<RequestOtpResponse> {
  return fetchApi<RequestOtpResponse>(
    '/auth/portal/sign-up/request-email-otp',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  );
}

export async function verifySignUp(
  email: string,
  otp: string,
  password: string,
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/auth/portal/sign-up/verify', {
    method: 'POST',
    body: JSON.stringify({ email, otp, password }),
  });
}

/*
 * Unified portal email-OTP sign-in. There is intentionally only one endpoint
 * pair for the web — the backend decides admin vs client from the user
 * record, and a license is not required to sign in.
 *
 * Unknown and ineligible addresses get the same generic response. After
 * verifying, the web reads GET /account/state to learn where to go.
 */
export async function requestPortalEmailOtp(
  email: string,
  password: string,
): Promise<RequestOtpResponse> {
  return fetchApi<RequestOtpResponse>('/auth/portal/request-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyPortalEmailOtp(
  email: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  // The session arrives as an HttpOnly cookie; the body carries no token.
  return fetchApi<VerifyOtpResponse>('/auth/portal/verify-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
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
  // Mobile phone-OTP route. Its bearer token belongs to the Android app and
  // is never stored or reused by the web portal.
  return fetchApi<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp: code }),
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchApi<CurrentUser>('/auth/me');
}

export function logout() {
  // Ask the backend to invalidate the HttpOnly session cookie. If it fails
  // (network drop mid-logout) we still clear local state so the UI never
  // shows a signed-in shell to an intended-signed-out user.
  void fetchApi('/auth/logout', { method: 'POST' }).catch(() => undefined);
  clearLegacyStoredToken();
  localStorage.removeItem('bantai_session');
  // Every sign-out path (topbars, account layout) drops the cached account
  // lifecycle state at once, so /login never bounces back into the app.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bantai:signed-out'));
  }
}

/*
 * Access-request licensing tiers. The names match the backend contract we
 * expect: one Shield subscription, reviewed manually before
 * anything downstream (proposal, invoice, Stripe checkout) is offered.
 */
export type AccessRequestTier = 'shield';

export type OrganizationDataAccess = 'EXPORTS' | 'API' | 'EXPORTS_AND_API';

export interface OrganizationDetails {
  website: string;
  deployment: string;
  dataAccess: OrganizationDataAccess;
  contactPerson?: string;
}

/* Mirrors backend CreateAccessRequestDto — only what review needs. */
export interface AccessRequestPayload {
  tier: AccessRequestTier;
  fullName: string;
  email: string;
  organization: string;
  applicantRole: string;
  /* How BantAI intelligence will be used. */
  intendedUse: string;
  /* The operational problem the subscriber needs intelligence to address. */
  reason: string;
  expectedUsers: number;
  organizationDetails?: OrganizationDetails;
  accuracyConfirmed: true;
  productUpdatesOptIn?: boolean;
  pilotInterest?: boolean;
}

export type BillingPeriod = 'MONTHLY' | 'ANNUAL';

/* Approved license scope, rendered verbatim on the agreement step. The
   backend (license-terms.ts) is the source of truth. */
export interface LicenseScope {
  name: string;
  purpose: string;
  dataset: string;
  users: string;
  exports: string;
  api: string;
  redistribution: string;
  reidentification: string;
  term: string;
}

/* The recurring amount checkout will charge, resolved by the backend from the
   same source Stripe checkout uses. Rendered before the terms are accepted. */
export interface PriceLine {
  amountMinor: number;
  currency: string;
  interval: 'month' | 'year';
  display: string;
}

export interface LicensePricing {
  confirmed: boolean;
  annual: PriceLine | null;
  monthly: PriceLine | null;
}
