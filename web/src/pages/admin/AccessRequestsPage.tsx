import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  approveAccessRequest,
  cancelAccessRequest,
  deleteAccessRequest,
  declineAccessRequest,
  getAccessRequest,
  getAccessRequests,
  reconcileAccessRequestPayment,
  resendActivationEmail,
  resendApprovalEmail,
  requestAccessRequestInfo,
  startAccessRequestReview,
  type AdminAccessRequest,
  type ApprovalResult,
  type AccessRequestStatus,
  type ApplicantHistory,
} from '../../services/accessRequestsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

type StatusFilter = 'all' | AccessRequestStatus;
type Decision = 'approve' | 'decline' | 'info' | null;
type LifecycleAction = 'cancel' | 'delete' | null;

/* Statuses a reviewer can still decide on (mirrors the backend). */
const REVIEWABLE = new Set<AccessRequestStatus>([
  'RECEIVED',
  'UNDER_REVIEW',
  'MORE_INFO_REQUIRED',
]);
/* Statuses that can be moved into active review. */
const STARTABLE = new Set<AccessRequestStatus>([
  'RECEIVED',
  'MORE_INFO_REQUIRED',
]);
/* More information can be requested only before a decision. */
const INFO_REQUESTABLE = new Set<AccessRequestStatus>([
  'RECEIVED',
  'UNDER_REVIEW',
]);
const CANCELLABLE = new Set<AccessRequestStatus>([
  'RECEIVED',
  'UNDER_REVIEW',
  'MORE_INFO_REQUIRED',
  'APPROVED',
  'AGREEMENT_ACCEPTED',
  'PAYMENT_PENDING',
]);
const DELETABLE = new Set<AccessRequestStatus>([
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
]);

const DETAIL_LABELS: Record<string, string> = {
  department: 'Department',
  country: 'Country',
  expectedDuration: 'Expected duration',
  willPublish: 'Will publish',
  website: 'Website',
  deployment: 'Deployment',
  dataAccess: 'Data access',
  contactPerson: 'Contact person',
};

function detailValue(value: string | boolean | undefined): string {
  if (value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return formatStatus(value);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusKind(status: AccessRequestStatus): StatusKind {
  if (
    status === 'ACTIVE' ||
    status === 'APPROVED' ||
    status === 'AGREEMENT_ACCEPTED'
  )
    return 'verified';
  if (status === 'DECLINED' || status === 'CANCELLED') return 'threat';
  if (
    status === 'PAYMENT_PENDING' ||
    status === 'UNDER_REVIEW' ||
    status === 'MORE_INFO_REQUIRED'
  ) {
    return 'suspicious';
  }
  return 'unknown';
}

/*
 * Returning applicants are identified for the reviewer (audit spec BY/U):
 * earlier requests on the same account and the licenses they produced.
 */
function ApplicantHistoryPanel({ request }: { request: AdminAccessRequest }) {
  const [history, setHistory] = useState<ApplicantHistory | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setHistory(null);
    setFailed(false);
    void getAccessRequest(request.id)
      .then((detail) => {
        if (active) setHistory(detail.applicantHistory);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [request.id]);

  if (failed) {
    return (
      <p style={{ color: 'var(--text-secondary)' }}>
        Applicant history could not be loaded.
      </p>
    );
  }
  if (!history) return null;
  if (!history.returningApplicant) {
    return (
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        New applicant — no earlier requests
        {request.hasAccount === false
          ? ' (legacy request without an account)'
          : ''}
        .
      </p>
    );
  }
  const latestLicense = history.requests.find((item) => item.license)?.license;
  return (
    <section
      aria-label="Applicant history"
      style={{
        marginBottom: 16,
        padding: 12,
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        background: 'var(--surface-canvas)',
      }}
    >
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
        Returning applicant
        {latestLicense
          ? ` · previously held Shield access${latestLicense.validUntil ? `, ended ${formatDate(latestLicense.validUntil)}` : ''}`
          : ''}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {history.requests.map((item) => (
          <li key={item.id}>
            {item.reference} · Shield · {formatStatus(item.status)} · submitted{' '}
            {formatDate(item.submittedAt)}
            {item.license
              ? ` · license ${formatStatus(item.license.status)} ${formatDate(item.license.validFrom)}–${item.license.validUntil ? formatDate(item.license.validUntil) : 'open'}`
              : ''}
            {item.organization !== request.organization
              ? ` · then: ${item.organization}`
              : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Detail({ request }: { request: AdminAccessRequest }) {
  const fields: [string, string][] = [
    ['Reference', request.reference],
    ['Applicant', request.fullName],
    ['Email', request.email],
    ['Role', request.applicantRole ?? '—'],
    ['Organization', request.organization],
    ['License', 'Shield'],
    ['Submitted', formatDate(request.submittedAt)],
    ['People needing access', String(request.expectedUsers ?? '—')],
    ['Problem addressed', request.reason],
    ['Intended use', request.intendedUse],
    ...Object.entries(request.details ?? {}).map(
      ([key, value]): [string, string] => [
        DETAIL_LABELS[key] ?? key,
        detailValue(value),
      ],
    ),
  ];
  fields.push(['Pilot consideration', request.pilotInterest ? 'Yes' : 'No']);
  if (request.infoRequestMessage) {
    fields.push([
      `Info requested ${formatDate(request.infoRequestedAt)}`,
      request.infoRequestMessage,
    ]);
  }
  if (request.declinedReason) {
    fields.push(['Decline reason', request.declinedReason]);
  }
  if (request.cancelledReason) {
    fields.push([
      `Cancelled ${formatDate(request.cancelledAt)}`,
      request.cancelledReason,
    ]);
  }
  if (request.agreementAcceptedAt) {
    fields.push([
      'Agreement accepted',
      `${formatDate(request.agreementAcceptedAt)} (terms ${request.agreementVersion ?? '—'})`,
    ]);
  }
  for (const delivery of request.emailDeliveries) {
    const label =
      delivery.kind === 'ACTIVATION'
        ? 'Payment confirmation email'
        : delivery.kind === 'APPROVAL'
          ? 'Approval email'
          : 'Submission email';
    fields.push([
      label,
      `${formatStatus(delivery.status)} · ${delivery.attempts} attempt${delivery.attempts === 1 ? '' : 's'} · ${formatDate(delivery.lastAttemptAt)}${delivery.errorCode ? ` · ${delivery.errorCode}` : ''}`,
    ]);
  }
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        margin: 0,
      }}
    >
      {fields.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <dt
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {label}
          </dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AccessRequestsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<AdminAccessRequest | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState<ApprovalResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAccessRequests();
      setRequests(next);
      setSelected((current) =>
        current ? (next.find((item) => item.id === current.id) ?? null) : null,
      );
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter)
        return false;
      if (!needle) return true;
      return [
        request.reference,
        request.fullName,
        request.email,
        request.organization,
        request.tier,
        request.status,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [requests, search, statusFilter]);

  const counts = useMemo(() => {
    const pending = requests.filter((request) =>
      REVIEWABLE.has(request.status),
    );
    return {
      pending: pending.length,
      shield: pending.filter((request) => request.tier === 'SHIELD').length,
      active: requests.filter((request) => request.status === 'ACTIVE').length,
    };
  }, [requests]);

  const columns: Column<AdminAccessRequest>[] = [
    {
      key: 'submitted',
      header: 'Submitted',
      render: (request) => formatDate(request.submittedAt),
      width: '14%',
    },
    {
      key: 'applicant',
      header: 'Applicant',
      render: (request) => request.fullName,
      width: '18%',
    },
    {
      key: 'organization',
      header: 'Organization',
      render: (request) => request.organization,
    },
    {
      key: 'tier',
      header: 'License',
      render: () => 'Shield',
      width: '14%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (request) => (
        <StatusBadge
          kind={statusKind(request.status)}
          label={formatStatus(request.status)}
        />
      ),
      width: '15%',
    },
  ];

  async function submitDecision() {
    if (!selected || !decision) return;
    setBusy(true);
    setActionError(null);
    try {
      if (decision === 'approve') {
        const result = await approveAccessRequest(selected.id);
        setApproval(result);
      } else if (decision === 'info') {
        await requestAccessRequestInfo(selected.id, infoMessage);
      } else {
        await declineAccessRequest(selected.id, declineReason);
      }
      setDecision(null);
      setDeclineReason('');
      setInfoMessage('');
      await load();
    } catch (decisionError) {
      setActionError(errorText(decisionError));
    } finally {
      setBusy(false);
    }
  }

  async function startReview() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await startAccessRequestReview(selected.id);
      await load();
    } catch (reviewError) {
      setActionError(errorText(reviewError));
    } finally {
      setBusy(false);
    }
  }

  async function resendApproval() {
    const request = approval?.request ?? selected;
    if (!request) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await resendApprovalEmail(request.id);
      setApproval(result);
      await load();
    } catch (resendError) {
      setActionError(errorText(resendError));
    } finally {
      setBusy(false);
    }
  }

  async function resendActivation() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const delivery = await resendActivationEmail(selected.id);
      if (delivery.status === 'failed') {
        setActionError(
          'The account remains active, but the payment confirmation email was not accepted. Check the recorded delivery status and retry after fixing SMTP.',
        );
      }
      await load();
    } catch (resendError) {
      setActionError(errorText(resendError));
    } finally {
      setBusy(false);
    }
  }

  async function reconcilePayment() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await reconcileAccessRequestPayment(selected.id);
      setNotice(result.message);
      await load();
    } catch (reconcileError) {
      setActionError(errorText(reconcileError));
    } finally {
      setBusy(false);
    }
  }

  async function submitLifecycleAction() {
    if (!selected || !lifecycleAction || lifecycleReason.trim().length < 5)
      return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      if (lifecycleAction === 'cancel') {
        await cancelAccessRequest(selected.id, lifecycleReason);
        setNotice('The unpaid access request was cancelled.');
      } else {
        const result = await deleteAccessRequest(selected.id, lifecycleReason);
        setNotice(`${result.reference} was permanently deleted.`);
        setSelected(null);
      }
      setLifecycleAction(null);
      setLifecycleReason('');
      await load();
    } catch (lifecycleError) {
      setActionError(errorText(lifecycleError));
    } finally {
      setBusy(false);
    }
  }

  const infoMessageValid = infoMessage.trim().length >= 10;

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Administration &middot; Access requests</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Access requests"
        description="Review Shield subscription applications before payment and account activation."
      />

      {error && !loading ? (
        <ErrorState
          title="Access requests unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading access requests" />
      ) : (
        <>
          <MetricRow columns={4}>
            <Metric label="Awaiting review" value={counts.pending} />
            <Metric label="Shield requests" value={counts.shield} />
            <Metric label="Active licenses" value={counts.active} />
          </MetricRow>

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              margin: '20px 0 16px',
            }}
          >
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch('')}
                placeholder="Search applicant, email, or organization"
              />
            </div>
            <div style={{ minWidth: 210 }}>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'RECEIVED', label: 'Received' },
                  { value: 'UNDER_REVIEW', label: 'Under review' },
                  {
                    value: 'MORE_INFO_REQUIRED',
                    label: 'More info required',
                  },
                  { value: 'APPROVED', label: 'Approved' },
                  {
                    value: 'AGREEMENT_ACCEPTED',
                    label: 'Agreement accepted',
                  },
                  { value: 'PAYMENT_PENDING', label: 'Payment pending' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'DECLINED', label: 'Declined' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'WITHDRAWN', label: 'Withdrawn' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>

          {actionError && (
            <p role="alert" style={{ color: 'var(--status-threat)' }}>
              {actionError}
            </p>
          )}
          {notice && (
            <p role="status" style={{ color: 'var(--status-verified)' }}>
              {notice}
            </p>
          )}

          <DataTable<AdminAccessRequest>
            ariaLabel="Shield access requests"
            rowKey={(request) => request.id}
            rows={rows}
            columns={columns}
            activeRowKey={selected?.id}
            onRowClick={setSelected}
            emptyState={
              <EmptyState
                title="No access requests match"
                description="New Shield subscription applications will appear here for review."
              />
            }
          />

          {selected && (
            <section
              aria-labelledby="access-request-detail-title"
              style={{
                marginTop: 16,
                padding: 20,
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                background: 'var(--surface-raised)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 20,
                }}
              >
                <div>
                  <h2 id="access-request-detail-title" style={{ margin: 0 }}>
                    Application details
                  </h2>
                  <p
                    style={{ color: 'var(--text-secondary)', marginBottom: 0 }}
                  >
                    Confirm the requested license and intended use before making
                    a decision.
                  </p>
                </div>
                {REVIEWABLE.has(selected.status) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STARTABLE.has(selected.status) && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void startReview()}
                      >
                        Start review
                      </Button>
                    )}
                    {INFO_REQUESTABLE.has(selected.status) && (
                      <Button
                        variant="ghost"
                        onClick={() => setDecision('info')}
                      >
                        Request more info
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setDecision('approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setDecision('decline')}
                    >
                      Decline
                    </Button>
                  </div>
                )}
                {selected.status === 'APPROVED' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void resendApproval()}
                  >
                    {busy ? 'Sending…' : 'Resend approval email'}
                  </Button>
                )}
                {selected.status === 'ACTIVE' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void resendActivation()}
                  >
                    {busy ? 'Sending…' : 'Resend payment email'}
                  </Button>
                )}
                {selected.status === 'PAYMENT_PENDING' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void reconcilePayment()}
                  >
                    {busy ? 'Checking…' : 'Check Stripe payment'}
                  </Button>
                )}
                {CANCELLABLE.has(selected.status) && (
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setLifecycleAction('cancel')}
                  >
                    Cancel request
                  </Button>
                )}
                {DELETABLE.has(selected.status) && (
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setLifecycleAction('delete')}
                  >
                    Delete request
                  </Button>
                )}
              </div>
              <ApplicantHistoryPanel request={selected} />
              <Detail request={selected} />
            </section>
          )}
        </>
      )}

      <Dialog
        open={decision !== null}
        title={
          decision === 'approve'
            ? 'Approve access request?'
            : decision === 'info'
              ? 'Request more information?'
              : 'Decline access request?'
        }
        description={
          decision === 'approve'
            ? 'Approval lets the applicant continue in their BantAI account: they accept the license terms, then pay. Access stays inactive until Stripe confirms payment.'
            : decision === 'info'
              ? 'Review pauses until the applicant replies. Say exactly what needs clarifying; this message is recorded on the request.'
              : 'Declining ends this application. Give the applicant a clear, specific reason for the decision.'
        }
        onClose={() => {
          if (!busy) setDecision(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDecision(null)}
            >
              Cancel
            </Button>
            <Button
              variant={
                decision === 'decline' ? 'destructive-confirm' : 'primary'
              }
              disabled={busy || (decision === 'info' && !infoMessageValid)}
              onClick={() => void submitDecision()}
            >
              {busy
                ? 'Saving…'
                : decision === 'approve'
                  ? 'Approve request'
                  : decision === 'info'
                    ? 'Send request for info'
                    : 'Decline request'}
            </Button>
          </>
        }
      >
        {decision === 'info' && (
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">
              What needs clarifying? (at least 10 characters)
            </span>
            <textarea
              className="bantai-p-input"
              rows={4}
              maxLength={1000}
              value={infoMessage}
              onChange={(event) => setInfoMessage(event.target.value)}
            />
          </label>
        )}
        {decision === 'decline' && (
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">Reason (optional)</span>
            <textarea
              className="bantai-p-input"
              rows={4}
              maxLength={500}
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
            />
          </label>
        )}
      </Dialog>

      <Dialog
        open={lifecycleAction !== null}
        title={
          lifecycleAction === 'delete'
            ? 'Permanently delete this request?'
            : 'Cancel this access request?'
        }
        description={
          lifecycleAction === 'delete'
            ? 'Deletion is irreversible and is allowed only for declined, cancelled, or expired requests with no payment, license, or account. A privacy-minimized audit record is retained.'
            : 'For payment-pending requests, BantAI checks Stripe first. A paid checkout will be activated and cannot be cancelled here.'
        }
        onClose={() => {
          if (!busy) setLifecycleAction(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setLifecycleAction(null)}
            >
              Keep request
            </Button>
            <Button
              variant="destructive-confirm"
              disabled={busy || lifecycleReason.trim().length < 5}
              onClick={() => void submitLifecycleAction()}
            >
              {busy
                ? 'Saving…'
                : lifecycleAction === 'delete'
                  ? 'Delete permanently'
                  : 'Cancel request'}
            </Button>
          </>
        }
      >
        <label className="bantai-p-field">
          <span className="bantai-p-field__label">
            Administrative reason (at least 5 characters)
          </span>
          <textarea
            className="bantai-p-input"
            rows={4}
            maxLength={500}
            value={lifecycleReason}
            onChange={(event) => setLifecycleReason(event.target.value)}
          />
        </label>
      </Dialog>

      <Dialog
        open={approval !== null}
        title={
          approval?.emailDelivery.status === 'sent'
            ? 'Request approved and emailed'
            : 'Request approved, but email failed'
        }
        description={
          approval?.emailDelivery.status === 'sent'
            ? 'The applicant was emailed that the request is approved. They continue by signing in to their account.'
            : 'The request is approved, but the notification email could not be delivered. The applicant can still continue by signing in; retry to send the email again.'
        }
        onClose={() => {
          setApproval(null);
        }}
        actions={
          <>
            {approval?.emailDelivery.status === 'failed' && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void resendApproval()}
              >
                {busy ? 'Sending…' : 'Retry email'}
              </Button>
            )}
            <Button variant="primary" onClick={() => setApproval(null)}>
              Done
            </Button>
          </>
        }
      >
        <p>
          Delivery address:{' '}
          <strong>{approval?.emailDelivery.to ?? selected?.email}</strong>
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          For security, the one-time token is sent only to the applicant and is
          not exposed in the admin browser.
        </p>
      </Dialog>
    </AppShell>
  );
}

export default AccessRequestsPage;
