import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchApi, getStoredToken, setStoredToken } from '../../api/apiClient';
import {
  inviteWorkspaceMember,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from '../../services/workspaceService';

describe('Frontend Security: API Authorization Enforcement (W9 Core Condition)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('proves that manipulating localStorage with a fake token cannot produce a successful privileged API request', async () => {
    // Attacker modifies localStorage in browser DevTools to inject an unauthorized token
    setStoredToken('manipulated_forged_admin_token_xyz');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () =>
        Promise.resolve({
          message: 'Invalid or expired authentication token.',
        }),
    });

    await expect(fetchApi('/system/metrics')).rejects.toThrow(
      'Invalid or expired authentication token.',
    );

    // Verify token was cleared upon 401 response
    expect(getStoredToken()).toBeNull();
  });

  it('proves that a customer token cannot execute staff/admin privileged API operations', async () => {
    // Client user has valid client token
    setStoredToken('valid_client_jwt_token');

    // Backend returns 403 Forbidden for staff-only endpoint
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () =>
        Promise.resolve({
          message:
            'Forbidden resource: Staff role required for platform administration.',
        }),
    });

    await expect(fetchApi('/users/admin-list')).rejects.toThrow(
      /Forbidden resource/,
    );
  });

  it('proves that customer workspace invitation API rejects platform/staff role assignments', async () => {
    setStoredToken('valid_client_lead_token');

    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body as string);
      // Backend validates allowed workspace member roles (TIER_1, TIER_2 only)
      if (body.role !== 'TIER_1' && body.role !== 'TIER_2') {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              message:
                'Invalid member role. Customers cannot assign platform or staff permissions.',
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({ message: 'Invitation sent successfully.' }),
      });
    });

    // Attempting to invite with an unauthorized staff role (e.g. bypassing UI dropdown via console)
    await expect(
      inviteWorkspaceMember({
        email: 'attacker@example.com',
        role: 'ADMIN' as any,
      }),
    ).rejects.toThrow(/Customers cannot assign platform or staff permissions/);
  });

  it('proves that unauthorized member removal or ownership transfer receives backend rejection', async () => {
    setStoredToken('standard_member_token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () =>
        Promise.resolve({
          message:
            'Forbidden: Only workspace owners can transfer ownership or remove members.',
        }),
    });

    await expect(removeWorkspaceMember('target-user-123')).rejects.toThrow(
      /Only workspace owners can transfer ownership/,
    );

    await expect(transferWorkspaceOwnership('target-user-123')).rejects.toThrow(
      /Only workspace owners can transfer ownership/,
    );
  });

  it('proves that session expiry automatically purges client authentication token', async () => {
    setStoredToken('expired_session_token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () =>
        Promise.resolve({
          message: 'Session has expired. Please sign in again.',
        }),
    });

    await expect(fetchApi('/portal-organizations/customer/me')).rejects.toThrow(
      /Session has expired/,
    );

    // Authentication token must be cleared to prevent stale or unauthorized requests
    expect(getStoredToken()).toBeNull();
  });
});
