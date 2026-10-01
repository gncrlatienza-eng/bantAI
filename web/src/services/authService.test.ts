import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requestSignUpOtp,
  verifyPortalEmailOtp,
  verifySignUp,
} from './authService';
import { startApplicationCheckout, submitApplication } from './accountService';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    throw new TypeError('Expected a JSON string request body.');
  }
  return JSON.parse(body) as unknown;
}

/* The unit-test runtime has no DOM storage; the client reads it for the
   legacy Bearer fallback, so provide a small in-memory stand-in. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

describe('account-first authentication transport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastCall() {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return {
      url,
      init,
      headers: new Headers(init.headers),
      body: parseJsonBody(init.body),
    };
  }

  it('requests a sign-up code with only the email, using the cookie session transport', async () => {
    await requestSignUpOtp('ana@uni.edu.ph');
    const call = lastCall();
    expect(call.url).toMatch(/\/auth\/portal\/sign-up\/request-email-otp$/);
    expect(call.init.method).toBe('POST');
    expect(call.init.credentials).toBe('include');
    expect(call.headers.has('Authorization')).toBe(false);
    expect(call.body).toEqual({ email: 'ana@uni.edu.ph' });
  });

  it('creates the account from the code and password without storing a token', async () => {
    await verifySignUp('ana@uni.edu.ph', '123456', 'a-long-password');
    const call = lastCall();
    expect(call.url).toMatch(/\/auth\/portal\/sign-up\/verify$/);
    expect(call.body).toEqual({
      email: 'ana@uni.edu.ph',
      otp: '123456',
      password: 'a-long-password',
    });
    // The session is an HttpOnly cookie set by the server.
    expect(localStorage.getItem('bantai_token')).toBeNull();
  });

  it('signs in with the cookie session and no Authorization header', async () => {
    await verifyPortalEmailOtp('ana@uni.edu.ph', '654321');
    const call = lastCall();
    expect(call.url).toMatch(/\/auth\/portal\/verify-email-otp$/);
    expect(call.init.credentials).toBe('include');
    expect(call.headers.has('Authorization')).toBe(false);
    expect(localStorage.getItem('bantai_token')).toBeNull();
  });

  it('never sends an email with a signed-in application (the server uses the account email)', async () => {
    await submitApplication({
      tier: 'shield',
      fullName: 'Ana Santos',
      organization: 'Example University',
      applicantRole: 'Security analyst',
      intendedUse: 'Monitor approved campaign intelligence.',
      reason: 'Protect customers from current smishing campaigns.',
      expectedUsers: 1,
      accuracyConfirmed: true,
      organizationDetails: {
        website: 'example.ph',
        deployment: 'Internal security operations monitoring.',
        dataAccess: 'EXPORTS',
      },
    });
    const call = lastCall();
    expect(call.url).toMatch(/\/account\/applications$/);
    expect(call.body).not.toHaveProperty('email');
  });

  it('starts checkout for a specific request id, URL-encoded', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'open', url: 'https://checkout.stripe.test/1' }),
    );
    await startApplicationCheckout('req/1', 'ANNUAL');
    const call = lastCall();
    expect(call.url).toMatch(/\/account\/applications\/req%2F1\/checkout$/);
    expect(call.body).toEqual({ billingPeriod: 'ANNUAL' });
  });

  it('surfaces the server status and machine-readable code on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 409,
          code: 'OPEN_REQUEST_EXISTS',
          message: 'This account already has an access request in progress.',
        },
        409,
      ),
    );
    await expect(
      startApplicationCheckout('req-1', 'MONTHLY'),
    ).rejects.toMatchObject({ status: 409, code: 'OPEN_REQUEST_EXISTS' });
  });
});
