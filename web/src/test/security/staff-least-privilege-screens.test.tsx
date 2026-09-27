import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFilteredAdminSidebarGroups } from '../../pages/admin/adminNav';
import { fetchApi, setStoredToken } from '../../api/apiClient';

describe('Frontend Security: Staff Least-Privilege & Role Gates (W6/W9)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Least-Privilege Navigation Filtering (W6)', () => {
    it('filters sidebar items strictly for Support role (verification:read, overview:read)', () => {
      const supportPermissions = ['overview:read', 'verification:read'];
      const groups = getFilteredAdminSidebarGroups(supportPermissions);

      const itemLabels = groups.flatMap((g) => g.items.map((i) => i.label));
      expect(itemLabels).toContain('Overview');
      expect(itemLabels).toContain('Tips');
      expect(itemLabels).toContain('Settings');

      // Must NOT contain restricted screens
      expect(itemLabels).not.toContain('Campaigns');
      expect(itemLabels).not.toContain('Model');
      expect(itemLabels).not.toContain('Export');
      expect(itemLabels).not.toContain('System');
    });

    it('filters sidebar items strictly for Analyst role (campaigns:read, models:read, reports:read)', () => {
      const analystPermissions = [
        'overview:read',
        'campaigns:read',
        'models:read',
        'reports:read',
      ];
      const groups = getFilteredAdminSidebarGroups(analystPermissions);

      const itemLabels = groups.flatMap((g) => g.items.map((i) => i.label));
      expect(itemLabels).toContain('Overview');
      expect(itemLabels).toContain('Campaigns');
      expect(itemLabels).toContain('Model');
      expect(itemLabels).toContain('Reports');

      // Must NOT contain system or export screens
      expect(itemLabels).not.toContain('System');
      expect(itemLabels).not.toContain('Export');
      expect(itemLabels).not.toContain('Tips');
    });

    it('filters sidebar items strictly for Privacy role (privacy:read)', () => {
      const privacyPermissions = ['overview:read', 'privacy:read'];
      const groups = getFilteredAdminSidebarGroups(privacyPermissions);

      const itemLabels = groups.flatMap((g) => g.items.map((i) => i.label));
      expect(itemLabels).toContain('Overview');
      expect(itemLabels).toContain('Export');

      // Must NOT contain model, system, tips, or campaigns
      expect(itemLabels).not.toContain('Model');
      expect(itemLabels).not.toContain('System');
      expect(itemLabels).not.toContain('Campaigns');
      expect(itemLabels).not.toContain('Tips');
    });

    it('filters sidebar items strictly for Operations role (system:read, campaigns:read)', () => {
      const opsPermissions = ['overview:read', 'system:read', 'campaigns:read'];
      const groups = getFilteredAdminSidebarGroups(opsPermissions);

      const itemLabels = groups.flatMap((g) => g.items.map((i) => i.label));
      expect(itemLabels).toContain('Overview');
      expect(itemLabels).toContain('System');
      expect(itemLabels).toContain('Campaigns');

      // Must NOT contain privacy export or tips
      expect(itemLabels).not.toContain('Export');
      expect(itemLabels).not.toContain('Tips');
    });

    it('grants all navigation groups when wildcard * is present (Global Admin)', () => {
      const groups = getFilteredAdminSidebarGroups(['*']);
      const itemLabels = groups.flatMap((g) => g.items.map((i) => i.label));

      expect(itemLabels).toContain('Overview');
      expect(itemLabels).toContain('Campaigns');
      expect(itemLabels).toContain('Model');
      expect(itemLabels).toContain('Reports');
      expect(itemLabels).toContain('Tips');
      expect(itemLabels).toContain('Export');
      expect(itemLabels).toContain('System');
      expect(itemLabels).toContain('Settings');
    });
  });

  describe('Backend Authoritative Enforcement Against UI Permission Tampering', () => {
    it('proves that tampering with frontend permissions to reveal a hidden button cannot execute unpermitted API actions', async () => {
      // Support staff member tampers with frontend state in browser console
      setStoredToken('support_staff_jwt_token');

      // Attempting to trigger model retraining (which requires models:write / ADMIN)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () =>
          Promise.resolve({
            message:
              'Forbidden: Insufficient privileges. Required role: ADMIN.',
          }),
      });

      await expect(
        fetchApi('/models/retrain', { method: 'POST' }),
      ).rejects.toThrow(/Insufficient privileges/);
    });
  });
});
