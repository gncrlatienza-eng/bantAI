import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { CampaignCluster } from '../../services/campaignsService';

const permission = vi.hoisted(() => ({ value: true }));
const data = vi.hoisted(() => ({
  active: [] as CampaignCluster[],
  inactive: [] as CampaignCluster[],
  archived: [] as CampaignCluster[],
}));

vi.mock('../../components/common/StaffPermissionGate', () => ({
  useStaffPermission: () => permission.value,
}));

vi.mock('../../services/campaignsService', () => ({
  getActiveCampaigns: vi.fn(() => Promise.resolve(data.active)),
  getInactiveCampaigns: vi.fn(() => Promise.resolve(data.inactive)),
  getArchivedCampaigns: vi.fn(() => Promise.resolve(data.archived)),
  deactivateCampaign: vi.fn(),
  archiveEmptyCampaigns: vi.fn(),
  runEmergingWaves: vi.fn(),
}));

import { CampaignsList } from './CampaignsList';

const DAY = 24 * 60 * 60 * 1000;

function cluster(over: Partial<CampaignCluster>): CampaignCluster {
  return {
    id: over.id ?? 'id',
    label: 'Bank phishing (BDO)',
    category: 'Bank phishing',
    urlDomains: [],
    isActive: false,
    createdAt: '2026-09-29T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    linkedMessageCount: 0,
    lastSeenAt: null,
    ...over,
  };
}

describe('CampaignsList (admin)', () => {
  beforeEach(() => {
    permission.value = true;
    data.active = [];
    data.inactive = [
      cluster({
        id: 'recent',
        label: 'Bank phishing (BDO) #2',
        linkedMessageCount: 4,
        lastSeenAt: new Date(Date.now() - 2 * DAY).toISOString(),
      }),
      cluster({
        id: 'old',
        label: 'Loan / credit offer #3',
        category: 'Loan / credit offer',
        linkedMessageCount: 9,
        lastSeenAt: new Date(Date.now() - 90 * DAY).toISOString(),
      }),
      cluster({
        id: 'promo',
        label: 'Promo (GCash) #5',
        category: 'Promo / marketing',
        linkedMessageCount: 16,
        lastSeenAt: new Date(Date.now() - DAY).toISOString(),
      }),
      cluster({ id: 'empty', label: 'cluster-82', category: null }),
      cluster({
        id: 'waiting',
        label: 'Parcel / delivery scam #4',
        category: 'Parcel / delivery scam',
        isActive: true,
      }),
      cluster({
        id: 'emerging',
        label: 'Rewards / prize claim (GCash)',
        category: 'Rewards / prize claim',
        origin: 'EMERGING',
        isActive: true,
        linkedMessageCount: 18,
        lastSeenAt: new Date(Date.now() - 3 * DAY).toISOString(),
      }),
    ];
    data.archived = [
      cluster({
        id: 'gone',
        label: 'E-wallet phishing (GCash)',
        category: 'E-wallet phishing',
        archivedAt: '2026-10-01T00:00:00Z',
        linkedMessageCount: 2,
        lastSeenAt: new Date(Date.now() - DAY).toISOString(),
      }),
    ];
  });

  it('shows only recent scam campaigns under Active, with cleaned titles', async () => {
    render(<CampaignsList role="admin" />);
    const table = await screen.findByRole('table', { name: 'Campaigns' });

    expect(await within(table).findByText('Bank phishing (BDO)')).toBeTruthy();
    // Retired-flag but recent activity still counts as Active.
    expect(within(table).queryByText(/#2/)).toBeNull();
    // Older, promo and never-matched clusters are not in the Active list.
    expect(within(table).queryByText('Loan offers')).toBeNull();
    expect(within(table).queryByText(/Promo/)).toBeNull();
    expect(within(table).queryByText(/cluster-82|Unlabeled/)).toBeNull();
    expect(
      screen.getByText(/1 promo, 1 retired with no messages, 1 archived/),
    ).toBeTruthy();
  });

  it('offers the bulk archive only with campaigns:manage', async () => {
    render(<CampaignsList role="admin" />);
    expect(
      await screen.findByRole('button', {
        name: 'Archive 1 empty retired cluster',
      }),
    ).toBeTruthy();
  });

  it('hides the bulk archive without campaigns:manage', async () => {
    permission.value = false;
    render(<CampaignsList role="admin" />);
    await screen.findByText('Bank phishing (BDO)');
    expect(screen.queryByRole('button', { name: /Archive/ })).toBeNull();
  });

  it('lists a Matching cluster with no messages yet under Inactive', async () => {
    render(<CampaignsList role="admin" />);
    const activeTable = await screen.findByRole('table', { name: 'Campaigns' });
    await within(activeTable).findByText('Bank phishing (BDO)');
    expect(within(activeTable).queryByText('Fake delivery texts')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Inactive/ }));
    const table = screen.getByRole('table', { name: 'Campaigns' });
    expect(within(table).getByText('Fake delivery texts')).toBeTruthy();
    expect(within(table).getByText('Loan offers')).toBeTruthy();
    // Retired and never matched: still hidden.
    expect(within(table).queryByText(/cluster-82|Unlabeled/)).toBeNull();
  });

  it('tags a server-found wave as new and puts it under Active', async () => {
    render(<CampaignsList role="admin" />);
    const table = await screen.findByRole('table', { name: 'Campaigns' });
    await within(table).findByText('Rewards / prize claim (GCash)');
    expect(within(table).getByText('New wave')).toBeTruthy();
  });

  it('has no Archived tab; archived campaigns appear only when asked for', async () => {
    render(<CampaignsList role="admin" />);
    const table = await screen.findByRole('table', { name: 'Campaigns' });
    await within(table).findByText('Bank phishing (BDO)');
    expect(screen.queryByRole('tab', { name: /Archived/ })).toBeNull();
    expect(within(table).queryByText('E-wallet phishing (GCash)')).toBeNull();

    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(within(table).getByText('E-wallet phishing (GCash)')).toBeTruthy();
    expect(within(table).getByText('Archived')).toBeTruthy();
  });

  it('pages long lists and returns to page 1 when the tab changes', async () => {
    data.inactive = Array.from({ length: 30 }, (_, i) =>
      cluster({
        id: `old-${i}`,
        label: `Old wave ${String(i).padStart(2, '0')}`,
        category: 'Other scam',
        linkedMessageCount: 1,
        lastSeenAt: new Date(Date.now() - (60 + i) * DAY).toISOString(),
      }),
    );
    render(<CampaignsList role="admin" />);
    await screen.findByText(/active campaigns? in the last 30 days/);
    fireEvent.click(screen.getByRole('tab', { name: /Inactive/ }));
    const table = screen.getByRole('table', { name: 'Campaigns' });

    expect(screen.getByText('Showing 1–25 of 30')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(26); // + header
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 26–30 of 30')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Inactive/ }));
    expect(screen.getByText('Showing 1–25 of 30')).toBeTruthy();
  });
});

describe('CampaignsList (Shield)', () => {
  it('lists dormant published campaigns under Inactive', async () => {
    data.active = [
      cluster({
        id: 'live',
        label: 'Rewards / prize claim (GCash)',
        status: 'ACTIVE',
        lastObserved: new Date(Date.now() - DAY).toISOString(),
      }),
    ];
    data.inactive = [
      cluster({
        id: 'quiet',
        label: 'Loan / credit offer',
        status: 'DORMANT',
        lastObserved: new Date(Date.now() - 90 * DAY).toISOString(),
      }),
    ];
    data.archived = [];
    render(<CampaignsList role="client" />);
    const table = await screen.findByRole('table', { name: 'Campaigns' });
    await within(table).findByText('Rewards / prize claim (GCash)');
    expect(within(table).queryByText('Loan / credit offer')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Inactive/ }));
    expect(within(table).getByText('Loan / credit offer')).toBeTruthy();
    expect(within(table).getByText('Inactive')).toBeTruthy();
  });
});
