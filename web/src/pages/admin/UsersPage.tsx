import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Metric,
  MetricRow,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from '../../components/primitives';
import {
  getAdministrativePortalAccounts,
  getLegacyLicenseReviews,
  reviewLegacyLicense,
  type LegacyLicenseReview,
  takePortalAccountAction,
  type PortalAccessStatus,
  type PortalAccountAction,
} from '../../services/portalAccountsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

interface AccountRow {
  key: string;
  userId: string;
  email: string;
  organization: string;
  memberRole: string;
  tier: string;
  billingStatus: string;
  shieldLicensed: boolean;
  legacyTier: string | null;
  shieldReviewDecision: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  accessStatus: PortalAccessStatus;
  accessReason: string | null;
  accessUpdatedAt: string | null;
}

interface PendingAction {
  row: AccountRow;
  action: PortalAccountAction;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

function shieldStatus(row: AccountRow): string {
  if (row.accessStatus === 'SUSPENDED') return 'SUSPENDED';
  if (row.accessStatus === 'REVOKED') return 'REVOKED';
  if (row.shieldLicensed) return 'ACTIVE';
  if (row.legacyTier && row.shieldReviewDecision === 'PENDING')
    return 'CONTRACT REVIEW';
  return 'UNAVAILABLE';
}

function actionLabel(action: PortalAccountAction) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

const REVIEW_BADGE: Record<
  LegacyLicenseReview['shieldReviewDecision'],
  'suspicious' | 'verified' | 'threat'
> = {
  PENDING: 'suspicious',
  APPROVED: 'verified',
  REJECTED: 'threat',
};

export function UsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [legacyLicenses, setLegacyLicenses] = useState<LegacyLicenseReview[]>(
    [],
  );
  const [reviewId, setReviewId] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>(
    'REJECTED',
  );
  const [reviewReason, setReviewReason] = useState('');
  const [reviewEvidence, setReviewEvidence] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [organizations, legacy] = await Promise.all([
        getAdministrativePortalAccounts(),
        getLegacyLicenseReviews(),
      ]);
      setLegacyLicenses(legacy);
      setRows(
        organizations.flatMap((organization) => {
          const license = organization.licenses[0];
          return organization.members.map((member) => ({
            key: member.id,
            userId: member.user.id,
            email: member.user.email ?? 'No email',
            organization: organization.name,
            memberRole: member.role.replace('_', ' '),
            tier:
              license?.tier ?? organization.licensedAccessRequest?.tier ?? '—',
            billingStatus: license?.status ?? 'NO LICENSE',
            shieldLicensed: organization.shieldLicensed,
            legacyTier: license?.legacyTier ?? null,
            shieldReviewDecision: license?.shieldReviewDecision ?? null,
            accessStatus: member.user.portalAccessStatus,
            accessReason: member.user.portalAccessReason,
            accessUpdatedAt: member.user.portalAccessUpdatedAt,
          }));
        }),
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.email,
        row.organization,
        row.tier,
        row.accessStatus,
        shieldStatus(row),
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [rows, search]);

  const counts = useMemo(
    () => ({
      active: rows.filter((row) => shieldStatus(row) === 'ACTIVE').length,
      review: rows.filter((row) => shieldStatus(row) === 'CONTRACT REVIEW')
        .length,
      restricted: rows.filter((row) =>
        ['SUSPENDED', 'REVOKED'].includes(shieldStatus(row)),
      ).length,
    }),
    [rows],
  );

  function openAction(row: AccountRow, action: PortalAccountAction) {
    setReason('');
    setError(null);
    setNotice(null);
    setPendingAction({ row, action });
  }

  async function submitAction() {
    if (!pendingAction || reason.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      const result = await takePortalAccountAction(
        pendingAction.row.userId,
        pendingAction.action,
        reason.trim(),
      );
      const label = actionLabel(pendingAction.action);
      setRows((current) =>
        current.map((row) =>
          row.userId === result.user.id
            ? {
                ...row,
                accessStatus: result.user.portalAccessStatus,
                accessReason: result.user.portalAccessReason,
                accessUpdatedAt: result.user.portalAccessUpdatedAt,
              }
            : row,
        ),
      );
      setPendingAction(null);
      setNotice(`${label} action recorded for ${pendingAction.row.email}.`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitLegacyReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewId || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await reviewLegacyLicense(
        reviewId,
        reviewDecision,
        reviewReason.trim(),
        reviewEvidence.trim(),
      );
      setReviewId('');
      setReviewReason('');
      setReviewEvidence('');
      await load();
      setNotice(
        'Contract decision recorded. Shield access now follows the reviewed decision and billing status.',
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<AccountRow>[] = [
    {
      key: 'account',
      header: 'Account',
      render: (row) => (
        <span>
          <strong>{row.email}</strong>
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>
            {row.organization} · {row.memberRole}
          </span>
        </span>
      ),
    },
    {
      key: 'license',
      header: 'License',
      render: (row) => (
        <span>
          {row.tier.replace('_', ' ')}
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>
            Billing: {row.billingStatus.replace('_', ' ')}
          </span>
        </span>
      ),
    },
    {
      key: 'access',
      header: 'Shield access',
      render: (row) => (
        <span>
          <StatusBadge
            kind={
              shieldStatus(row) === 'ACTIVE'
                ? 'verified'
                : shieldStatus(row) === 'CONTRACT REVIEW'
                  ? 'suspicious'
                  : 'threat'
            }
            label={shieldStatus(row)}
          />
          <span
            style={{
              display: 'block',
              marginTop: 6,
              color: 'var(--text-secondary)',
            }}
          >
            Account control: {row.accessStatus}
          </span>
          {row.accessReason && (
            <span
              title={row.accessReason}
              style={{ display: 'block', marginTop: 6, maxWidth: 220 }}
            >
              {row.accessReason}
              <br />
              <small>{formatDate(row.accessUpdatedAt)}</small>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          {row.accessStatus === 'ACTIVE' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openAction(row, 'suspend')}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openAction(row, 'restore')}
            >
              Restore
            </Button>
          )}
          {row.accessStatus !== 'REVOKED' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openAction(row, 'revoke')}
            >
              Revoke
            </Button>
          )}
        </span>
      ),
    },
  ];

  const reviewTarget = legacyLicenses.find(
    (license) => license.id === reviewId,
  );

  const legacyColumns: Column<LegacyLicenseReview>[] = [
    {
      key: 'account',
      header: 'Account',
      render: (license) => (
        <span style={{ display: 'grid', gap: 2 }}>
          <strong>{license.organizationName}</strong>
          <span style={{ overflowWrap: 'anywhere' }}>
            {license.accountEmail}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {license.applicantName}
          </span>
        </span>
      ),
    },
    {
      key: 'request',
      header: 'Request',
      render: (license) => (
        <span style={{ display: 'grid', gap: 2 }}>
          <span>{license.requestReference}</span>
          <span
            title={license.id}
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
            }}
          >
            License {license.id.slice(0, 8)}…
          </span>
        </span>
      ),
    },
    {
      key: 'plan',
      header: 'Original plan',
      render: (license) => license.legacyTier.replace('_', ' '),
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (license) => license.status.replace('_', ' '),
    },
    {
      key: 'review',
      header: 'Shield review',
      render: (license) => (
        <StatusBadge
          kind={REVIEW_BADGE[license.shieldReviewDecision]}
          label={license.shieldReviewDecision}
        />
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (license) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError(null);
            setNotice(null);
            setReviewId(license.id);
            setReviewReason('');
            setReviewEvidence('');
            setReviewDecision('REJECTED');
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Administration &middot; Users</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Portal accounts"
        description="Manage client access independently from Stripe billing. Every suspension, restoration, and revocation requires a reason and is audited."
      />

      {notice && <p role="status">{notice}</p>}
      {error && !loading && !pendingAction && !reviewId ? (
        <ErrorState
          title="Portal accounts unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading portal accounts" />
      ) : (
        <>
          <MetricRow columns={4}>
            <Metric label="Accounts" value={rows.length.toLocaleString()} />
            <Metric
              label="Shield active"
              value={counts.active.toLocaleString()}
            />
            <Metric
              label="Contract review"
              value={counts.review.toLocaleString()}
            />
            <Metric
              label="Restricted"
              value={counts.restricted.toLocaleString()}
            />
          </MetricRow>

          <div style={{ margin: '20px 0 16px', maxWidth: 420 }}>
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search email or organization"
            />
          </div>

          <DataTable<AccountRow>
            ariaLabel="Portal accounts"
            rowKey={(row) => row.key}
            rows={filteredRows}
            columns={columns}
            emptyState={
              <EmptyState
                title={
                  search ? 'No accounts match the search' : 'No accounts yet'
                }
                description={
                  search
                    ? 'Clear the search to see all portal accounts.'
                    : 'Accounts appear after paid access is claimed.'
                }
              />
            }
          />
          <section
            aria-labelledby="legacy-license-title"
            style={{ marginTop: 40 }}
          >
            <header className="bantai-pageheader">
              <h2
                id="legacy-license-title"
                className="bantai-pageheader__title"
                style={{ fontSize: '1.15rem' }}
              >
                Historical contract review
              </h2>
              <p className="bantai-pageheader__description">
                Older Research and Organization licenses keep their billing
                history. Shield access stays off until an Admin checks each
                contract and records a decision.
              </p>
            </header>
            <DataTable<LegacyLicenseReview>
              ariaLabel="Historical licenses awaiting contract review"
              rowKey={(license) => license.id}
              rows={legacyLicenses}
              columns={legacyColumns}
              emptyState={
                <EmptyState
                  title="No historical licenses require review"
                  description="Older Research and Organization licenses appear here until an Admin records a contract decision."
                />
              }
            />
          </section>
        </>
      )}

      <Dialog
        open={reviewId !== ''}
        title="Record contract decision"
        description={`${reviewTarget ? `${reviewTarget.organizationName} · ${reviewTarget.accountEmail} · ${reviewTarget.requestReference}` : `License ${reviewId.slice(0, 8)}…`}. Verify the signed terms before granting Shield intelligence. This action is audited.`}
        onClose={() => {
          if (!busy) setReviewId('');
        }}
      >
        <form
          onSubmit={(event) => void submitLegacyReview(event)}
          style={{ display: 'grid', gap: 12 }}
        >
          <Select
            label="Decision"
            value={reviewDecision}
            onChange={(event) =>
              setReviewDecision(event.target.value as 'APPROVED' | 'REJECTED')
            }
            options={[
              { value: 'REJECTED', label: 'Do not grant Shield' },
              {
                value: 'APPROVED',
                label: 'Grant Shield after contract review',
              },
            ]}
          />
          <Input
            label="Contract evidence reference"
            helpText="5–120 characters, e.g. a signed-contract file or ticket ID."
            required
            minLength={5}
            maxLength={120}
            value={reviewEvidence}
            onChange={(event) => setReviewEvidence(event.target.value)}
          />
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">
              Reason (15–500 characters)
            </span>
            <textarea
              className="bantai-p-input"
              required
              minLength={15}
              maxLength={500}
              rows={4}
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
            />
          </label>
          {error && reviewId && <p role="alert">{error}</p>}
          <div className="bantai-p-dialog__actions">
            <Button
              disabled={busy}
              type="button"
              variant="ghost"
              onClick={() => setReviewId('')}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                reviewEvidence.trim().length < 5 ||
                reviewReason.trim().length < 15
              }
              type="submit"
            >
              {busy ? 'Saving…' : 'Record decision'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={pendingAction !== null}
        title={
          pendingAction
            ? `${actionLabel(pendingAction.action)} portal access?`
            : 'Take account action?'
        }
        description={
          pendingAction
            ? `${pendingAction.row.email} will be blocked or restored immediately. Stripe billing is not changed by this action.`
            : undefined
        }
        onClose={() => {
          if (!busy) setPendingAction(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={
                pendingAction?.action === 'restore'
                  ? 'primary'
                  : 'destructive-confirm'
              }
              disabled={busy || reason.trim().length < 5}
              onClick={() => void submitAction()}
            >
              {busy
                ? 'Saving…'
                : pendingAction
                  ? actionLabel(pendingAction.action)
                  : 'Save'}
            </Button>
          </>
        }
      >
        <label className="bantai-p-field">
          <span className="bantai-p-field__label">
            Reason (5–500 characters)
          </span>
          <textarea
            className="bantai-p-input"
            rows={4}
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && pendingAction && <p role="alert">{error}</p>}
      </Dialog>
    </AppShell>
  );
}

export default UsersPage;
