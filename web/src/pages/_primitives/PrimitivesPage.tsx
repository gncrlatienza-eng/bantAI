/*
 * Dev-only primitives preview.
 *
 * Registered at /_primitives only when import.meta.env.DEV is true. Renders
 * every Phase D primitive on the mineral canvas so we can eyeball spacing,
 * hover, focus, disabled, and semantic reinforcement.
 */

import React from 'react';
import {
  Button,
  IconButton,
  Input,
  Select,
  SearchInput,
  StatusBadge,
  InfoBadge,
  ConfidenceMeter,
  Tabs,
  EmptyState,
  LoadingState,
  ErrorState,
  Skeleton,
  Metric,
  MetricRow,
  DataTable,
  Dialog,
  NotificationsIcon,
  HelpIcon,
  FilterIcon,
  NavSystemIcon,
  type TabDef,
  type Column,
  type SortDirection,
} from '../../components/primitives';

type Msg = {
  id: string;
  sender: string;
  preview: string;
  kind: 'threat' | 'suspicious' | 'verified' | 'unknown';
  confidence: number;
  received: string;
};

const SAMPLE_ROWS: Msg[] = [
  {
    id: 'm1',
    sender: '+63 917 555 0192',
    preview:
      'Your GCash account has been flagged. Verify at bit.ly/gcash-verify to avoid suspension.',
    kind: 'threat',
    confidence: 0.94,
    received: '2m ago',
  },
  {
    id: 'm2',
    sender: '+63 918 220 4415',
    preview: 'Meeting moved to 3pm at the Innovation Hub.',
    kind: 'verified',
    confidence: 0.87,
    received: '18m ago',
  },
  {
    id: 'm3',
    sender: 'BDO-Alert',
    preview:
      'Delivery pending. Confirm shipping fee of PHP 45 to release parcel.',
    kind: 'suspicious',
    confidence: 0.62,
    received: '42m ago',
  },
  {
    id: 'm4',
    sender: '+63 995 108 3320',
    preview: 'Kailangan namin ng OTP mo para ma-verify ang transaction.',
    kind: 'threat',
    confidence: 0.81,
    received: '1h ago',
  },
  {
    id: 'm5',
    sender: '+63 917 442 9911',
    preview: 'Unknown number, no context yet.',
    kind: 'unknown',
    confidence: 0.11,
    received: '2h ago',
  },
];

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'classification', label: 'Classification' },
  { id: 'fp-fn', label: 'FP / FN' },
  { id: 'concept-drift', label: 'Concept Drift' },
  { id: 'dataset', label: 'Training Dataset', disabled: true },
];

function Row({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 28,
        background: 'var(--surface-raised)',
        borderRadius: 8,
        padding: 20,
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: '0.95rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

export function PrimitivesPage() {
  React.useEffect(() => {
    const previous = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'mineral');
    return () => {
      if (previous == null) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', previous);
      }
    };
  }, []);

  const [inputValue, setInputValue] = React.useState('');
  const [tabId, setTabId] = React.useState<string>('overview');

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        padding: '48px 32px 96px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
            }}
          >
            BantAI primitives / dev only
          </p>
          <h1
            style={{
              margin: '4px 0 8px',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Phase D primitives
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              maxWidth: '65ch',
            }}
          >
            Every Layer 2 component. All colors resolve through semantic tokens;
            no palette or legacy references. Confidence is decoupled from
            classification (rule 6 of semantic.css).
          </p>
        </header>

        <Row title="Button variants">
          <Button variant="primary">Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete campaign</Button>
          <Button variant="destructive-confirm">Delete</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>

        <Row title="Button sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>

        <Row title="Input / Select / SearchInput">
          <div style={{ minWidth: 260 }}>
            <Input
              label="Phone"
              placeholder="+63 917 000 0000"
              error="Enter a valid Philippine mobile number."
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <Select
              label="Classification"
              defaultValue=""
              placeholder="All classifications"
              options={[
                { value: 'threat', label: 'Likely Smishing' },
                { value: 'suspicious', label: 'Suspicious' },
                { value: 'verified', label: 'Verified' },
                { value: 'unknown', label: 'Unknown' },
              ]}
              helpText="Filter the list to a single classification."
            />
          </div>
          <div style={{ minWidth: 320, alignSelf: 'end' }}>
            <SearchInput
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onClear={() => setInputValue('')}
              placeholder="Search sender, preview, or campaign"
            />
          </div>
        </Row>

        <Row title="IconButton">
          <IconButton ariaLabel="Notifications">
            <NotificationsIcon />
          </IconButton>
          <IconButton ariaLabel="Help">
            <HelpIcon />
          </IconButton>
          <IconButton ariaLabel="Filter" outlined>
            <FilterIcon />
          </IconButton>
          <IconButton ariaLabel="Settings" disabled>
            <NavSystemIcon />
          </IconButton>
        </Row>

        <Row title="Dialog (destructive confirmation)">
          <DialogDemo />
        </Row>

        <Row title="StatusBadge (soft variant)">
          <StatusBadge kind="unknown" />
          <StatusBadge kind="verified" />
          <StatusBadge kind="suspicious" />
          <StatusBadge kind="threat" />
          <StatusBadge kind="critical" />
        </Row>

        <Row title="StatusBadge (solid variant, for card overlays)">
          <StatusBadge kind="unknown" solid />
          <StatusBadge kind="verified" solid />
          <StatusBadge kind="suspicious" solid />
          <StatusBadge kind="threat" />
          <StatusBadge kind="critical" />
        </Row>

        <Row title="InfoBadge (petrol, AI/model insight)">
          <InfoBadge>AI classification</InfoBadge>
          <InfoBadge>Shared indicators with 27 messages</InfoBadge>
          <InfoBadge>Model v0.6.2</InfoBadge>
        </Row>

        <Row title="Classification + ConfidenceMeter (decoupled)">
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '8px 0',
            }}
          >
            <StatusBadge kind="threat" />
            <ConfidenceMeter value={82} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '8px 0',
            }}
          >
            <StatusBadge kind="suspicious" />
            <ConfidenceMeter value={0.63} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '8px 0',
            }}
          >
            <StatusBadge kind="verified" />
            <ConfidenceMeter value={0.98} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '8px 0',
            }}
          >
            <StatusBadge kind="unknown" />
            <ConfidenceMeter value={0} compact />
          </div>
        </Row>

        <Row title="Tabs (used by /admin/model consolidation)">
          <div style={{ width: '100%' }}>
            <Tabs
              tabs={TABS}
              activeId={tabId}
              onChange={setTabId}
              label="Model sections"
            >
              <div
                style={{
                  padding: '16px 0',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                }}
              >
                Active panel: <strong>{tabId}</strong>. Tab state syncs to URL
                via query string in real usage.
              </div>
            </Tabs>
          </div>
        </Row>

        <Row title="EmptyState / LoadingState / ErrorState">
          <div style={{ width: '100%', display: 'grid', gap: 16 }}>
            <EmptyState
              title="No messages match the current filters"
              description="Clear a filter or expand the date range to see suspicious activity."
              action={<Button variant="secondary">Clear filters</Button>}
            />
            <LoadingState label="Loading messages..." />
            <ErrorState
              title="Failed to load campaign data"
              description="The campaign clustering service did not respond. Message ingestion is unaffected."
              action={<Button variant="secondary">Retry</Button>}
            />
          </div>
        </Row>

        <Row title="Skeleton">
          <div style={{ width: '100%', maxWidth: 480 }}>
            <Skeleton height={20} width="60%" />
            <Skeleton height={14} width="90%" />
            <Skeleton height={14} width="80%" />
            <Skeleton variant="row" style={{ marginTop: 12 }} />
          </div>
        </Row>

        <Row title="Metric row (Section 15 overview)">
          <div style={{ width: '100%' }}>
            <MetricRow columns={4}>
              <Metric label="Active campaigns" value="18" />
              <Metric label="Likely smishing" value="327" meta="past 24h" />
              <Metric label="Suspicious" value="83" meta="past 24h" />
              <Metric label="Messages today" value="714" />
            </MetricRow>
          </div>
        </Row>

        <Row title="DataTable (interactive)">
          <MessagesTable />
        </Row>

        <Row title="DataTable (loading)">
          <div style={{ width: '100%' }}>
            <DataTable<Msg>
              ariaLabel="Loading example"
              rowKey={(r) => r.id}
              rows={[]}
              loading
              loadingRows={4}
              columns={makeColumns()}
            />
          </div>
        </Row>

        <Row title="DataTable (empty)">
          <div style={{ width: '100%' }}>
            <DataTable<Msg>
              ariaLabel="Empty example"
              rowKey={(r) => r.id}
              rows={[]}
              columns={makeColumns()}
              emptyState={
                <EmptyState
                  title="No messages match"
                  description="Try broadening the filters."
                />
              }
            />
          </div>
        </Row>
      </div>
    </main>
  );
}

export default PrimitivesPage;

function makeColumns(): Column<Msg>[] {
  return [
    {
      key: 'sender',
      header: 'Sender',
      render: (r) => r.sender,
      sortable: true,
      width: '18%',
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (r) => r.preview,
      truncate: true,
    },
    {
      key: 'kind',
      header: 'Classification',
      render: (r) => <StatusBadge kind={r.kind} />,
      sortable: true,
      width: '15%',
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (r) => <ConfidenceMeter value={r.confidence} compact />,
      align: 'right',
      sortable: true,
      width: '14%',
    },
    {
      key: 'received',
      header: 'Received',
      render: (r) => r.received,
      align: 'right',
      sortable: true,
      width: '12%',
    },
  ];
}

function DialogDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete campaign
      </Button>
      <Dialog
        open={open}
        title="Delete this campaign?"
        description="Deleting removes the campaign and its associated indicators. Messages classified under it remain in the message log. This action cannot be undone."
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              onClick={() => setOpen(false)}
            >
              Delete campaign
            </Button>
          </>
        }
      />
    </>
  );
}

function MessagesTable() {
  const [sortKey, setSortKey] = React.useState<string>('received');
  const [sortDir, setSortDir] = React.useState<SortDirection>('desc');
  const [selected, setSelected] = React.useState<string | undefined>();

  const sorted = React.useMemo(() => {
    const rows = [...SAMPLE_ROWS];
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === 'number' && typeof bv === 'number')
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [sortKey, sortDir]);

  return (
    <div style={{ width: '100%' }}>
      <DataTable<Msg>
        ariaLabel="Sample messages"
        rowKey={(r) => r.id}
        rows={sorted}
        columns={makeColumns()}
        onRowClick={(r) => setSelected(r.id)}
        activeRowKey={selected}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSortChange={(k, d) => {
          setSortKey(k);
          setSortDir(d);
        }}
      />
      {selected && (
        <p
          style={{
            marginTop: 8,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          Selected: <code>{selected}</code>
        </p>
      )}
    </div>
  );
}
