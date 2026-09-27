/*
 * Shared Campaigns list.
 *
 * Rendered by both client (/client/campaigns) and admin (/admin/campaigns).
 * Consumers pass their own onCampaignClick handler and admin-only actions
 * (deactivate). Everything else - fetch, filter, search, sort, table - is
 * identical across both surfaces so we do not maintain two copies.
 *
 * Note: CampaignCluster has no explicit severity field. The list displays
 * lifecycle status only and keeps the semantic color neutral.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  StatusBadge,
  SearchInput,
  Select,
  EmptyState,
  ErrorState,
  type Column,
  type SortDirection,
  type StatusKind,
} from '../../components/primitives';
import {
  deactivateCampaign,
  getActiveCampaigns,
  getInactiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import { useStaffPermission } from '../../components/common/StaffPermissionGate';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

function computeStatus(): StatusKind {
  // The backend exposes lifecycle state but no campaign severity. Keep the
  // semantic color neutral rather than inventing a risk level.
  return 'unknown';
}

interface CampaignRow {
  id: string;
  label: string;
  severity: StatusKind;
  isActive: boolean;
  messageCount: number;
  domainCount: number;
  createdAt: string;
  updatedAt: string;
  original: CampaignCluster;
}

function toRow(c: CampaignCluster): CampaignRow {
  return {
    id: c.id,
    label: c.label || 'Unlabeled campaign',
    severity: computeStatus(),
    isActive: c.isActive,
    messageCount: c.messageCount,
    domainCount: c.urlDomains.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
    original: c,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type StatusFilter = 'all' | 'active' | 'inactive';
interface CampaignsListProps {
  role: 'client' | 'admin';
  onCampaignClick?: (campaign: CampaignCluster) => void;
}

export function CampaignsList({ role, onCampaignClick }: CampaignsListProps) {
  const canManageCampaigns = useStaffPermission('campaigns:manage');
  const [active, setActive] = useState<CampaignCluster[]>([]);
  const [inactive, setInactive] = useState<CampaignCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortKey, setSortKey] = useState<string>('messageCount');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [act, inact] = await Promise.all([
        getActiveCampaigns(),
        getInactiveCampaigns(),
      ]);
      setActive(act);
      setInactive(inact);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const source =
      statusFilter === 'active'
        ? active
        : statusFilter === 'inactive'
          ? inactive
          : [...active, ...inactive];

    let mapped = source.map(toRow);

    const needle = search.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter(
        (r) =>
          r.label.toLowerCase().includes(needle) ||
          r.id.toLowerCase().includes(needle) ||
          r.original.urlDomains.some((d) => d.toLowerCase().includes(needle)),
      );
    }

    mapped.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const valueFor = (row: CampaignRow): string | number => {
        switch (sortKey) {
          case 'messageCount':
            return row.messageCount;
          case 'domainCount':
            return row.domainCount;
          case 'updatedAt':
            return row.updatedAt;
          case 'severity':
            return row.isActive ? 1 : 0;
          default:
            return row.label;
        }
      };
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });

    return mapped;
  }, [active, inactive, statusFilter, search, sortKey, sortDir]);

  async function handleDeactivate(row: CampaignRow) {
    setActionError(null);
    try {
      await deactivateCampaign(row.id);
      await load();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  const columns: Column<CampaignRow>[] = [
    {
      key: 'label',
      header: 'Campaign',
      render: (r) => <span style={{ fontWeight: 500 }}>{r.label}</span>,
      sortable: true,
    },
    {
      key: 'severity',
      header: 'Status',
      render: (r) => (
        <StatusBadge
          kind={r.severity}
          label={r.isActive ? 'Active' : 'Inactive'}
        />
      ),
      sortable: true,
      width: '15%',
    },
    {
      key: 'messageCount',
      header: 'Messages',
      render: (r) => r.messageCount.toLocaleString(),
      align: 'right',
      sortable: true,
      width: '11%',
    },
    {
      key: 'domainCount',
      header: 'Domains',
      render: (r) => r.domainCount.toLocaleString(),
      align: 'right',
      sortable: true,
      width: '10%',
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (r) => formatDate(r.updatedAt),
      align: 'right',
      sortable: true,
      width: '14%',
    },
    ...(role === 'admin' && canManageCampaigns
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: '10%',
            render: (r: CampaignRow) =>
              r.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeactivate(r);
                  }}
                >
                  Deactivate
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  if (error && !loading) {
    return (
      <ErrorState
        title="Live data unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search campaign label, id, or domain"
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
      </div>

      {actionError && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 6,
            background:
              'color-mix(in srgb, var(--status-threat) 12%, var(--surface-raised))',
            color: 'var(--status-threat)',
            fontSize: '0.85rem',
          }}
          role="alert"
        >
          {actionError}
        </div>
      )}

      <DataTable<CampaignRow>
        ariaLabel="Campaigns"
        rowKey={(r) => r.id}
        rows={rows}
        columns={columns}
        loading={loading}
        onRowClick={
          onCampaignClick ? (r) => onCampaignClick(r.original) : undefined
        }
        sortKey={sortKey}
        sortDirection={sortDir}
        onSortChange={(k, d) => {
          setSortKey(k);
          setSortDir(d);
        }}
        emptyState={
          <EmptyState
            title={
              search
                ? 'No campaigns match the current filters'
                : 'No campaigns yet'
            }
            description={
              search
                ? 'Clear a filter or broaden the search to see more results.'
                : 'Campaigns appear here as the backend clusters incoming messages.'
            }
            action={
              search ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('active');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </>
  );
}
