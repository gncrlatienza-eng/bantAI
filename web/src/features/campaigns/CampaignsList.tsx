/*
 * Shared Campaigns list.
 *
 * Rendered by Shield and Admin with different scopes.
 * Consumers pass their own onCampaignClick handler and admin-only actions
 * (deactivate). Everything else - fetch, filter, search, sort, table - is
 * identical across both surfaces so we do not maintain two copies.
 *
 * Severity comes from the reviewed campaign `risk` (LOW..CRITICAL) that the
 * backend returns to both audiences; unreviewed campaigns stay neutral.
 *
 * Admin reads like the phone's Scam Waves (see campaignDisplay.ts): Active
 * means a linked message arrived in the last 30 days, newest activity first,
 * cleaned titles, and promo / retired never-matched clusters hidden unless
 * asked for. A Matching cluster with no messages yet sits under Inactive and
 * moves to Active by itself once the matcher links a text to it.
 * The backend isActive flag is the matcher state, shown as "Matching" /
 * "Retired"; offline-clustering syncs flip it, so it says nothing about
 * whether a scam is still arriving.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  DataTable,
  Dialog,
  StatusBadge,
  SearchInput,
  Select,
  EmptyState,
  ErrorState,
  Tabs,
  type Column,
  type SortDirection,
  type StatusKind,
} from '../../components/primitives';
import {
  archiveEmptyCampaigns,
  deactivateCampaign,
  runEmergingWaves,
  getActiveCampaigns,
  getArchivedCampaigns,
  getInactiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import { useStaffPermission } from '../../components/common/StaffPermissionGate';
import {
  displayTitle,
  distinctTitles,
  friendlyCategory,
  isPromo,
  isRecentlyActive,
} from './campaignDisplay';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

function riskToStatus(risk?: string | null): StatusKind {
  switch (risk) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'threat';
    case 'MEDIUM':
      return 'suspicious';
    default:
      // LOW, UNKNOWN or not yet reviewed: neutral, never "verified".
      return 'unknown';
  }
}

const RISK_ORDER: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function riskLabel(risk?: string | null): string {
  return risk && risk !== 'UNKNOWN'
    ? risk.charAt(0) + risk.slice(1).toLowerCase()
    : 'Not rated';
}

type Bucket = 'active' | 'inactive';

interface CampaignRow {
  id: string;
  title: string;
  category: string;
  severity: StatusKind;
  risk: string | null;
  isActive: boolean;
  archivedAt: string | null;
  messageCount: number;
  countVerified: boolean;
  linkedMessageCount: number;
  lastSeenAt: string | null;
  domainCount: number;
  createdAt: string;
  updatedAt: string;
  bucket: Bucket;
  /** Grouped on the server from unmatched scam texts; not yet reviewed. */
  isEmerging: boolean;
  original: CampaignCluster;
}

function toRow(c: CampaignCluster, now: number): CampaignRow {
  // Admin gets lastSeenAt; Shield gets the same signal as lastObserved.
  const lastSeenAt = c.lastSeenAt ?? c.lastObserved ?? null;
  return {
    id: c.id,
    title: displayTitle(c),
    category: friendlyCategory(c.category),
    severity: riskToStatus(c.risk),
    risk: c.risk ?? null,
    isActive: c.isActive,
    archivedAt: c.archivedAt ?? null,
    messageCount: c.messageCount ?? 0,
    countVerified: c.countVerified !== false,
    linkedMessageCount: c.linkedMessageCount ?? 0,
    lastSeenAt,
    domainCount: c.urlDomains.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
    bucket: isRecentlyActive(lastSeenAt, now) ? 'active' : 'inactive',
    isEmerging: c.origin === 'EMERGING',
    original: c,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function lastSeenLabel(iso: string | null, now: number): string {
  if (!iso) return 'Never';
  const seen = new Date(iso).getTime();
  if (Number.isNaN(seen)) return 'Never';
  const days = Math.floor((now - seen) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

interface CampaignsListProps {
  role: 'client' | 'admin';
  onCampaignClick?: (campaign: CampaignCluster) => void;
}

const ALL_CATEGORIES = '';
const PAGE_SIZE = 25;

// Brings the list's top (tabs / filters) back into view when the reader is
// scrolled past it, e.g. after switching tab or page from far down the list.
function revealTop(el: HTMLElement | null) {
  if (el && el.getBoundingClientRect().top < 0) {
    el.scrollIntoView({ block: 'start' });
  }
}

export function CampaignsList({ role, onCampaignClick }: CampaignsListProps) {
  const isAdmin = role === 'admin';
  const canManageCampaigns = useStaffPermission('campaigns:manage');
  const [active, setActive] = useState<CampaignCluster[]>([]);
  const [inactive, setInactive] = useState<CampaignCluster[]>([]);
  const [archived, setArchived] = useState<CampaignCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Fixed per load so recency buckets don't shift while the page is open.
  const [now, setNow] = useState(() => Date.now());

  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<Bucket>('active');
  const [page, setPage] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [showPromo, setShowPromo] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [finding, setFinding] = useState(false);
  const [sortKey, setSortKey] = useState<string>('lastSeen');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const act = await getActiveCampaigns();
      const [inact, archivedCampaigns] =
        role === 'admin'
          ? await Promise.all([getInactiveCampaigns(), getArchivedCampaigns()])
          : [await getInactiveCampaigns(), []];
      setActive(act);
      setInactive(inact);
      setArchived(archivedCampaigns);
      setNow(Date.now());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  // Admin: every cluster once, bucketed by recency; then the noise filters.
  const adminView = useMemo(() => {
    if (!isAdmin) return null;
    const seen = new Set<string>();
    const all = [...active, ...inactive, ...archived]
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
      .map((c) => toRow(c, now));
    let hiddenPromo = 0;
    let hiddenEmpty = 0;
    let hiddenArchived = 0;
    const visible = all.filter((r) => {
      // Archived is an Admin decision (wrong, duplicate, junk), not an
      // activity state, so it is a filter rather than a third tab.
      if (!showArchived && r.archivedAt) {
        hiddenArchived += 1;
        return false;
      }
      if (!showPromo && isPromo(r.original.category)) {
        hiddenPromo += 1;
        return false;
      }
      // A Matching cluster with no messages yet stays visible (under
      // Inactive): the matcher can still assign it a text, which makes it
      // Active. A Retired one never can, so it is hidden unless asked for.
      if (!showEmpty && r.linkedMessageCount === 0 && !r.isActive) {
        hiddenEmpty += 1;
        return false;
      }
      return true;
    });
    const counts: Record<Bucket, number> = { active: 0, inactive: 0 };
    visible.forEach((r) => (counts[r.bucket] += 1));
    const categories = [...new Set(visible.map((r) => r.category))].sort();
    const emptyRetired = all.filter(
      (r) => !r.archivedAt && !r.isActive && r.linkedMessageCount === 0,
    ).length;
    return {
      visible,
      counts,
      categories,
      hiddenPromo,
      hiddenEmpty,
      hiddenArchived,
      emptyRetired,
    };
  }, [
    isAdmin,
    active,
    inactive,
    archived,
    now,
    showPromo,
    showEmpty,
    showArchived,
  ]);

  const clientView = useMemo(() => {
    if (isAdmin) return null;
    const seen = new Set<string>();
    const all = [...active, ...inactive]
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
      .map((c) => toRow(c, now));
    const counts: Record<Bucket, number> = { active: 0, inactive: 0 };
    all.forEach((r) => (counts[r.bucket] += 1));
    return { all, counts };
  }, [isAdmin, active, inactive, now]);
  const tabCounts = adminView?.counts ?? clientView?.counts ?? null;

  const rows = useMemo(() => {
    let mapped: CampaignRow[];
    if (adminView) {
      mapped = adminView.visible.filter(
        (r) =>
          r.bucket === bucket &&
          (category === ALL_CATEGORIES || r.category === category),
      );
    } else {
      // Shield: its published campaigns, Active or Inactive by recency.
      mapped = (clientView?.all ?? []).filter((r) => r.bucket === bucket);
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          (r.original.label ?? '').toLowerCase().includes(needle) ||
          r.id.toLowerCase().includes(needle) ||
          (isAdmin &&
            (r.category.toLowerCase().includes(needle) ||
              r.original.urlDomains.some((d) =>
                d.toLowerCase().includes(needle),
              ))),
      );
    }

    mapped.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'lastSeen') {
        // Never-seen clusters sink to the bottom in either direction.
        if (!a.lastSeenAt || !b.lastSeenAt) {
          return (a.lastSeenAt ? 0 : 1) - (b.lastSeenAt ? 0 : 1);
        }
        return a.lastSeenAt.localeCompare(b.lastSeenAt) * dir;
      }
      const valueFor = (row: CampaignRow): string | number => {
        switch (sortKey) {
          case 'messageCount':
            return isAdmin ? row.linkedMessageCount : row.messageCount;
          case 'domainCount':
            return row.domainCount;
          case 'updatedAt':
            return row.updatedAt;
          case 'createdAt':
            return row.createdAt;
          case 'severity':
            return RISK_ORDER[row.risk ?? ''] ?? 0;
          default:
            return row.title;
        }
      };
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });

    return distinctTitles(
      mapped,
      (r) => r.original.urlDomains[0] ?? r.id.slice(0, 8),
    );
  }, [
    adminView,
    clientView,
    bucket,
    category,
    search,
    sortKey,
    sortDir,
    isAdmin,
  ]);

  // Any change to what the list shows starts again at page 1.
  useEffect(() => {
    setPage(0);
  }, [
    bucket,
    category,
    search,
    showPromo,
    showEmpty,
    showArchived,
    sortKey,
    sortDir,
  ]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  function goToPage(next: number) {
    setPage(next);
    revealTop(topRef.current);
  }

  async function handleDeactivate(row: CampaignRow) {
    setActionError(null);
    try {
      await deactivateCampaign(row.id);
      await load();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  async function handleArchiveEmpty() {
    setActionError(null);
    setNotice(null);
    setArchiving(true);
    try {
      const { archived: count } = await archiveEmptyCampaigns();
      setConfirmArchive(false);
      setNotice(
        count === 0
          ? 'There were no empty retired clusters to archive.'
          : `Archived ${plural(count, 'empty retired cluster')}. Nothing was deleted.`,
      );
      await load();
    } catch (e) {
      setConfirmArchive(false);
      setActionError(errorText(e));
    } finally {
      setArchiving(false);
    }
  }

  async function handleFindWaves() {
    setActionError(null);
    setNotice(null);
    setFinding(true);
    try {
      const { newWaves, attached } = await runEmergingWaves();
      setNotice(
        newWaves === 0 && attached === 0
          ? 'No new scam waves found. Every recent scam text is already in a campaign, or has no similar texts yet.'
          : [
              newWaves > 0 && `Found ${plural(newWaves, 'new wave')}`,
              attached > 0 &&
                `added ${plural(attached, 'text')} to existing waves`,
            ]
              .filter(Boolean)
              .join(', ') + '. New waves are drafts until reviewed.',
      );
      await load();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setFinding(false);
    }
  }

  function resetFilters() {
    setSearch('');
    setCategory(ALL_CATEGORIES);
    setShowPromo(false);
    setShowEmpty(false);
    setShowArchived(false);
  }

  const columns: Column<CampaignRow>[] = isAdmin
    ? [
        {
          key: 'label',
          header: 'Campaign',
          render: (r) => (
            <span style={{ display: 'grid', gap: 2 }}>
              <span
                style={{
                  fontWeight: 500,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  opacity: r.archivedAt ? 0.6 : 1,
                }}
              >
                {r.title}
                {r.isEmerging && (
                  <span
                    title="Grouped by the server from scam texts that matched no known campaign. Review before publishing."
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        'color-mix(in srgb, var(--status-suspicious) 18%, transparent)',
                      color: 'var(--status-suspicious)',
                    }}
                  >
                    New wave
                  </span>
                )}
              </span>
              {/* A title that fell back to the category would repeat it. */}
              {!r.title.startsWith(r.category) && (
                <span
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  {r.category}
                </span>
              )}
            </span>
          ),
          sortable: true,
        },
        {
          key: 'severity',
          header: 'Risk',
          render: (r) => (
            <StatusBadge kind={r.severity} label={riskLabel(r.risk)} />
          ),
          sortable: true,
          width: '12%',
        },
        {
          key: 'messageCount',
          header: 'Messages',
          render: (r) => r.linkedMessageCount.toLocaleString(),
          align: 'right',
          sortable: true,
          width: '10%',
        },
        {
          key: 'lastSeen',
          header: 'Last seen',
          render: (r) => lastSeenLabel(r.lastSeenAt, now),
          align: 'right',
          sortable: true,
          width: '13%',
        },
        {
          key: 'domainCount',
          header: 'Domains',
          render: (r) => r.domainCount.toLocaleString(),
          align: 'right',
          sortable: true,
          width: '9%',
        },
        {
          key: 'lifecycle',
          header: 'Matcher',
          render: (r) => (
            <span
              title={
                r.isActive
                  ? 'New messages are matched to this cluster'
                  : 'Retired from matching; kept for history'
              }
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            >
              {r.archivedAt ? 'Archived' : r.isActive ? 'Matching' : 'Retired'}
            </span>
          ),
          width: '10%',
        },
        ...(canManageCampaigns
          ? [
              {
                key: 'actions',
                header: '',
                align: 'right' as const,
                width: '10%',
                render: (r: CampaignRow) =>
                  r.isActive && !r.archivedAt ? (
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
      ]
    : [
        {
          key: 'label',
          header: 'Campaign',
          render: (r) => <span style={{ fontWeight: 500 }}>{r.title}</span>,
          sortable: true,
        },
        {
          key: 'severity',
          header: 'Risk',
          render: (r) => (
            <StatusBadge kind={r.severity} label={riskLabel(r.risk)} />
          ),
          sortable: true,
          width: '13%',
        },
        {
          key: 'lifecycle',
          header: 'Status',
          render: (r) => (r.bucket === 'active' ? 'Active' : 'Inactive'),
          width: '11%',
        },
        {
          key: 'createdAt',
          header: 'First observed',
          render: (r) => formatDate(r.createdAt),
          sortable: true,
          width: '18%',
        },
        {
          key: 'lastSeen',
          header: 'Last observed',
          render: (r) => lastSeenLabel(r.lastSeenAt, now),
          align: 'right',
          sortable: true,
          width: '14%',
        },
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

  const filtersActive =
    search !== '' ||
    category !== ALL_CATEGORIES ||
    showPromo ||
    showEmpty ||
    showArchived;
  const hiddenCount = adminView
    ? adminView.hiddenPromo + adminView.hiddenEmpty + adminView.hiddenArchived
    : 0;

  return (
    <>
      <div ref={topRef} style={{ scrollMarginTop: 16 }} />
      {tabCounts && (
        <>
          <p
            style={{ margin: '16px 0 8px', color: 'var(--text-secondary)' }}
            aria-live="polite"
          >
            {loading
              ? 'Loading campaigns…'
              : `${plural(tabCounts.active, 'active campaign')} in the last 30 days` +
                (adminView && hiddenCount > 0
                  ? ` · ${hiddenCount.toLocaleString()} hidden (${[
                      adminView.hiddenPromo > 0 &&
                        `${adminView.hiddenPromo.toLocaleString()} promo`,
                      adminView.hiddenEmpty > 0 &&
                        `${adminView.hiddenEmpty.toLocaleString()} retired with no messages`,
                      adminView.hiddenArchived > 0 &&
                        `${adminView.hiddenArchived.toLocaleString()} archived`,
                    ]
                      .filter(Boolean)
                      .join(', ')})`
                  : '')}
          </p>
          <Tabs
            label="Campaign status"
            activeId={bucket}
            onChange={(id) => {
              setBucket(id as Bucket);
              revealTop(topRef.current);
            }}
            tabs={[
              {
                id: 'active',
                label: 'Active',
                badge: tabCounts.active,
              },
              {
                id: 'inactive',
                label: 'Inactive',
                badge: tabCounts.inactive,
              },
            ]}
          />
        </>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          margin: '16px 0',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder={
              isAdmin
                ? 'Search campaign, category, id, or domain'
                : 'Search campaign name or ID'
            }
          />
        </div>
        {adminView && (
          <>
            <div style={{ minWidth: 200 }}>
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: ALL_CATEGORIES, label: 'All categories' },
                  ...adminView.categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={showPromo}
                onChange={(e) => setShowPromo(e.target.checked)}
              />
              Show promo / marketing
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={showEmpty}
                onChange={(e) => setShowEmpty(e.target.checked)}
              />
              Show retired clusters with no messages
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </>
        )}
        {adminView && canManageCampaigns && (
          <Button
            variant="secondary"
            onClick={() => void handleFindWaves()}
            disabled={finding}
            style={{ marginLeft: 'auto' }}
          >
            {finding ? 'Looking…' : 'Find new waves'}
          </Button>
        )}
        {adminView && canManageCampaigns && adminView.emptyRetired > 0 && (
          <Button variant="secondary" onClick={() => setConfirmArchive(true)}>
            Archive {plural(adminView.emptyRetired, 'empty retired cluster')}
          </Button>
        )}
      </div>

      {notice && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 6,
            background: 'var(--surface-raised)',
            fontSize: '0.85rem',
          }}
          role="status"
        >
          {notice}
        </div>
      )}

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
        rows={pageRows}
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
              filtersActive
                ? 'No campaigns match the current filters'
                : isAdmin && bucket === 'active'
                  ? 'No campaigns active in the last 30 days'
                  : 'No campaigns yet'
            }
            description={
              filtersActive
                ? 'Clear a filter or broaden the search to see more results.'
                : isAdmin && bucket === 'active'
                  ? 'A campaign is active while a linked message arrived in the last 30 days. Older ones are under Inactive.'
                  : 'Campaigns appear here as the backend clusters incoming messages.'
            }
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      {!loading && rows.length > PAGE_SIZE && (
        <nav
          aria-label="Campaign pages"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 12,
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {`Showing ${(currentPage * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
              (currentPage + 1) * PAGE_SIZE,
              rows.length,
            ).toLocaleString()} of ${rows.length.toLocaleString()}`}
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => goToPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span style={{ fontSize: '0.85rem' }}>
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </Button>
          </span>
        </nav>
      )}

      {isAdmin && (
        <Dialog
          open={confirmArchive}
          title="Archive empty retired clusters?"
          description={`This archives ${plural(
            adminView?.emptyRetired ?? 0,
            'cluster',
          )} that are retired from matching and never had a message linked to them. Most are leftovers from earlier offline-clustering runs. Nothing is deleted; tick “Show archived” to see them again.`}
          onClose={() => {
            if (!archiving) setConfirmArchive(false);
          }}
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => setConfirmArchive(false)}
                disabled={archiving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive-confirm"
                onClick={() => void handleArchiveEmpty()}
                disabled={archiving}
              >
                {archiving ? 'Archiving…' : 'Archive'}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
