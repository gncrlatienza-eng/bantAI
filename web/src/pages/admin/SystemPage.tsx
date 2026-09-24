/*
 * Admin System page. Phase F step 8 + Phase A step 5.
 *
 * Consolidates three legacy admin routes (/admin/server, /admin/api-logs,
 * /admin/db-storage) into one page with tabs synced to ?tab=. Legacy paths
 * redirect via AppRoutes so old deep links still land.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  Tabs,
  type StatusKind,
  type TabDef,
} from '../../components/primitives';
import {
  getHealthStatus,
  getReadinessStatus,
  type HealthStatus,
  type ReadinessStatus,
} from '../../services/healthService';
import { logout } from '../../services/authService';
import { useAdminNavGroups } from './adminNav';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

const TABS: TabDef[] = [
  { id: 'server', label: 'Server health' },
  { id: 'api-logs', label: 'API logs' },
  { id: 'db-storage', label: 'DB storage' },
];

function statusToKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'up' || s === 'ready' || s === 'healthy')
    return 'verified';
  if (s === 'degraded' || s === 'warning') return 'suspicious';
  if (s === 'down' || s === 'error' || s === 'failed') return 'threat';
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Server health tab                                                 */
/* ------------------------------------------------------------------ */

function ServerHealthTab() {
  const [data, setData] = useState<{
    health: HealthStatus;
    readiness: ReadinessStatus;
    latencyMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const started = performance.now();
      const [health, readiness] = await Promise.all([
        getHealthStatus(),
        getReadinessStatus(),
      ]);
      setData({
        health,
        readiness,
        latencyMs: Math.round(performance.now() - started),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Checking backend health" />;
  if (error) {
    return (
      <ErrorState
        title="Health check failed"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!data) return null;

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Backend"
          value={
            <StatusBadge
              kind={statusToKind(data.health.status)}
              label={data.health.status}
            />
          }
        />
        <Metric
          label="Database"
          value={
            <StatusBadge
              kind={statusToKind(data.readiness.database)}
              label={data.readiness.database}
            />
          }
        />
        <Metric label="Version" value={data.health.version} />
        <Metric
          label="Round-trip"
          value={`${data.latencyMs.toLocaleString()} ms`}
        />
      </MetricRow>

      <p
        style={{
          margin: '20px 0 0',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
        }}
      >
        Backend uptime: {Math.floor(data.health.uptime).toLocaleString()}{' '}
        seconds &middot; Reported at{' '}
        {new Date(data.health.timestamp).toLocaleString()} &middot; Service{' '}
        {data.health.service}
      </p>

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => void load()}>
          Recheck now
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder tab renderer                                          */
/* ------------------------------------------------------------------ */

function NotConnectedTab({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={<InfoBadge>{hint}</InfoBadge>}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                        */
/* ------------------------------------------------------------------ */

export function SystemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navGroups = useAdminNavGroups();

  const activeTab = useMemo(() => {
    const t = searchParams.get('tab') ?? 'server';
    return TABS.some((tab) => tab.id === t) ? t : 'server';
  }, [searchParams]);

  function selectTab(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === 'server') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <AppShell
      role="admin"
      groups={navGroups}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={
        location.pathname.startsWith('/admin/system') ||
        location.pathname === '/admin/server' ||
        location.pathname === '/admin/api-logs' ||
        location.pathname === '/admin/db-storage'
          ? '/admin/system'
          : location.pathname
      }
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Administration &middot; System</span>}
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
        title="System"
        description="Backend health, API request logs, and database storage — one page, three tabs. Only the tabs whose backend endpoints exist show live data."
      />
      <Tabs
        tabs={TABS}
        activeId={activeTab}
        onChange={selectTab}
        label="System sections"
      >
        <div style={{ paddingTop: 20 }}>
          {activeTab === 'server' && <ServerHealthTab />}
          {activeTab === 'api-logs' && (
            <NotConnectedTab
              title="API request log not connected"
              description="A per-request audit log with method, path, status, and latency requires an authenticated endpoint that has not shipped yet."
              hint="Requires GET /admin/api-logs on the backend"
            />
          )}
          {activeTab === 'db-storage' && (
            <NotConnectedTab
              title="Database storage stats not connected"
              description="Row counts per table and on-disk size require an authenticated endpoint that has not shipped yet."
              hint="Requires GET /admin/db-storage on the backend"
            />
          )}
        </div>
      </Tabs>
    </AppShell>
  );
}

export default SystemPage;
