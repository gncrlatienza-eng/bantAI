import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFilteredAdminSidebarGroups } from '../../pages/admin/adminNav';
import {
  ADMIN_NAV,
  ADMIN_UTILITY,
  adminPathPermitted,
  breadcrumbFor,
  firstPermittedAdminPath,
  visibleTabs,
} from '../../navigation/portalNav';
import { fetchApi } from '../../api/apiClient';

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
    const labels = (permissions: string[]) =>
      getFilteredAdminSidebarGroups(permissions).flatMap((g) =>
        g.items.map((i) => i.label),
      );

    it('shows Support only Overview and Review (verification:read, overview:read)', () => {
      expect(labels(['overview:read', 'verification:read'])).toEqual([
        'Overview',
        'Review',
      ]);
    });

    it('shows Analyst Overview, Review, Campaigns and Model', () => {
      expect(
        labels([
          'overview:read',
          'campaigns:manage',
          'models:read',
          'reports:read',
        ]),
      ).toEqual(['Overview', 'Review', 'Campaigns', 'Model']);
    });

    it('shows Privacy only Overview (privacy:read)', () => {
      expect(labels(['overview:read', 'privacy:read'])).toEqual(['Overview']);
    });

    it('shows Operations Overview, Campaigns and System', () => {
      expect(
        labels(['overview:read', 'system:read', 'campaigns:manage']),
      ).toEqual(['Overview', 'Campaigns', 'System']);
    });

    it('shows a full-access admin all eight sections, settings excluded', () => {
      const groups = getFilteredAdminSidebarGroups(['*']);
      expect(groups.map((g) => g.label)).toEqual([undefined, 'Manage']);
      expect(labels(['*'])).toEqual([
        'Overview',
        'Review',
        'Campaigns',
        'Messages',
        'Model',
        'Customers',
        'Tips',
        'System',
      ]);
    });

    it('shows nothing to an admin without a staff role', () => {
      expect(labels([])).toEqual([]);
    });
  });

  describe('Hub tabs and landing follow the same permissions', () => {
    const review = ADMIN_NAV[0].sections.find((s) => s.id === 'review')!;
    const system = ADMIN_NAV[1].sections.find((s) => s.id === 'system')!;

    it('gives each role only its own Review tabs', () => {
      const ids = (p: string[]) => visibleTabs(review, p).map((t) => t.id);
      expect(ids(['verification:read'])).toEqual(['senders']);
      expect(ids(['reports:read', 'verification:read'])).toEqual([
        'reports',
        'senders',
      ]);
      expect(ids(['models:read'])).toEqual(['detections']);
    });

    it('keeps Audit and Exports for full access only', () => {
      expect(visibleTabs(system, ['system:read']).map((t) => t.id)).toEqual([
        'health',
        'logs',
        'storage',
      ]);
      expect(adminPathPermitted('/admin/system/audit', ['system:read'])).toBe(
        false,
      );
      expect(adminPathPermitted('/admin/system/audit', ['*'])).toBe(true);
    });

    it('lands each account on the first screen it can use', () => {
      expect(firstPermittedAdminPath(['*'])).toBe('/admin/overview');
      expect(firstPermittedAdminPath(['verification:read'])).toBe(
        '/admin/review/senders',
      );
      expect(firstPermittedAdminPath([])).toBe('/admin/settings/profile');
      expect(adminPathPermitted('/admin/overview', [])).toBe(false);
      expect(adminPathPermitted('/admin/settings/profile', [])).toBe(true);
      expect(adminPathPermitted('/admin/notifications', [])).toBe(true);
    });

    it('builds the top-bar breadcrumb from the registry', () => {
      expect(
        breadcrumbFor(ADMIN_NAV, ADMIN_UTILITY, '/admin/review/senders'),
      ).toEqual([
        { label: 'Review', path: '/admin/review' },
        { label: 'Sender reports' },
      ]);
      expect(
        breadcrumbFor(ADMIN_NAV, ADMIN_UTILITY, '/admin/campaigns/c1'),
      ).toEqual([
        { label: 'Campaigns', path: '/admin/campaigns' },
        { label: 'Campaign' },
      ]);
      expect(breadcrumbFor(ADMIN_NAV, ADMIN_UTILITY, '/admin/tips')).toEqual([
        { label: 'Tips' },
      ]);
    });
  });

  describe('Mock forbidden response transport', () => {
    it('surfaces a simulated backend refusal without treating client state as authority', async () => {
      // Support staff member tampers with frontend state in browser console
      localStorage.setItem('bantai_token', 'support_staff_jwt_token');

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
