/*
 * System → Audit: the full staff audit trail. Mounted by the System hub
 * (routes/AppRoutes.tsx); /admin/audit redirects there.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  type Column,
} from '../../components/primitives';
import {
  getAdminAuditEvents,
  type AdminAuditEvent,
} from '../../services/adminAuditService';
import { formatCompactDateTime } from '../../utils/dateFormat';

const MONO = { fontFamily: 'var(--font-mono)', fontSize: '0.85rem' } as const;

function shortId(id: string) {
  return (
    <code title={id} style={MONO}>
      {id.slice(0, 8)}…
    </code>
  );
}

function eventLabel(type: string) {
  const words = type.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function eventTarget(event: AdminAuditEvent) {
  const target: [string, string | null][] = [
    ['Account', event.organizationId],
    ['User', event.targetUserId],
    ['Request', event.accessRequestId],
    ['License', event.licenseId],
  ];
  const found = target.find(([, id]) => id);
  if (!found || !found[1]) return '—';
  return (
    <span>
      <span style={{ color: 'var(--text-secondary)' }}>{found[0]} </span>
      {shortId(found[1])}
    </span>
  );
}

const COLUMNS: Column<AdminAuditEvent>[] = [
  {
    key: 'when',
    header: 'When',
    render: (event) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        {formatCompactDateTime(new Date(event.createdAt))}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (event) => eventLabel(event.type),
  },
  {
    key: 'actor',
    header: 'Actor',
    render: (event) =>
      event.actorUserId ? (
        shortId(event.actorUserId)
      ) : (
        <span style={{ color: 'var(--text-secondary)' }}>System</span>
      ),
  },
  { key: 'target', header: 'Target', render: eventTarget },
];

export function AuditEventsPanel() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Routine reads are recorded but hidden by default so approvals, license
  // changes and investigations stay findable (manual QA 2026-10-01, F5).
  const [includeReads, setIncludeReads] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await getAdminAuditEvents(includeReads));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Audit events could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [includeReads]);
  useEffect(() => {
    void load();
  }, [load]);
  const typeOptions = useMemo(
    () => [
      { value: '', label: 'All event types' },
      ...[...new Set(events.map((event) => event.type))]
        .sort()
        .map((type) => ({ value: type, label: eventLabel(type) })),
    ],
    [events],
  );
  const visible = typeFilter
    ? events.filter((event) => event.type === typeFilter)
    : events;
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 220 }}>
          <Select
            label="Event type"
            hideLabel
            value={typeFilter}
            options={typeOptions}
            onChange={(event) => setTypeFilter(event.target.value)}
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
            checked={includeReads}
            onChange={(event) => {
              setTypeFilter('');
              setIncludeReads(event.target.checked);
            }}
          />
          Include routine reads
        </label>
      </div>
      {loading ? (
        <LoadingState label="Loading audit events…" />
      ) : error ? (
        <ErrorState
          title="Audit events unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable<AdminAuditEvent>
          ariaLabel="Audit events"
          rowKey={(event) => event.id}
          rows={visible}
          columns={COLUMNS}
          emptyState={
            <EmptyState
              title="No audit events"
              description={
                typeFilter
                  ? 'No recent events of this type.'
                  : 'Recorded actions will appear here.'
              }
            />
          }
        />
      )}
    </>
  );
}
