/*
 * Admin Users page — portal organizations table.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  SearchInput,
  StatusBadge,
  type Column,
} from '../../components/primitives';
import {
  getPortalOrganizations,
  type PortalOrganizationItem,
} from '../../services/portalOrganizationsService';
import { logout } from '../../services/authService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
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

export function UsersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [orgs, setOrgs] = useState<PortalOrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrgs(await getPortalOrganizations());
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
    const needle = search.trim().toLowerCase();
    return needle
      ? orgs.filter((o) => o.name.toLowerCase().includes(needle))
      : orgs;
  }, [orgs, search]);

  const counts = useMemo(() => {
    let active = 0;
    let members = 0;
    for (const o of orgs) {
      if (o.isActive) active++;
      members += o._count.members;
    }
    return { active, members };
  }, [orgs]);

  const columns: Column<PortalOrganizationItem>[] = [
    {
      key: 'name',
      header: 'Organization',
      render: (o) => <span style={{ fontWeight: 500 }}>{o.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <StatusBadge
          kind={o.isActive ? 'verified' : 'unknown'}
          label={o.isActive ? 'Active' : 'Inactive'}
        />
      ),
      width: '15%',
    },
    {
      key: 'members',
      header: 'Members',
      render: (o) => o._count.members.toLocaleString(),
      align: 'right',
      width: '15%',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (o) => formatDate(o.createdAt),
      align: 'right',
      width: '18%',
    },
  ];

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Administration &middot; Users</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/admin-login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Portal organizations"
        description="Every organization with access to the BantAI portal, with member counts and lifecycle state."
      />

      {error && !loading ? (
        <ErrorState
          title="Organizations unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading organizations" />
      ) : (
        <>
          <MetricRow columns={3}>
            <Metric
              label="Organizations"
              value={orgs.length.toLocaleString()}
            />
            <Metric label="Active" value={counts.active.toLocaleString()} />
            <Metric
              label="Total members"
              value={counts.members.toLocaleString()}
            />
          </MetricRow>

          <div style={{ margin: '20px 0 16px', maxWidth: 360 }}>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search organizations"
            />
          </div>

          <DataTable<PortalOrganizationItem>
            ariaLabel="Portal organizations"
            rowKey={(o) => o.id}
            rows={rows}
            columns={columns}
            emptyState={
              <EmptyState
                title={
                  search
                    ? 'No organizations match the search'
                    : 'No organizations yet'
                }
                description={
                  search
                    ? 'Clear the search to see all organizations.'
                    : 'Organizations appear here once portal accounts are registered.'
                }
              />
            }
          />
        </>
      )}
    </AppShell>
  );
}

export default UsersPage;
