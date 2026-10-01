import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { Button, Dialog } from '../../components/primitives';
import '../../components/primitives/primitives.css';
import { useAccountState } from '../../context/AccountStateContext';
import {
  listMyApplications,
  withdrawApplication,
  type ApplicationSummary,
} from '../../services/accountService';
import { AccessTracker, stepForStatus } from '../RequestAccess/accessSteps';
import '../RequestAccess/request-access.css';

/*
 * ApplicationPage — the signed-in request status (audit spec Q/BR). Shows the
 * current request and its history. There is no second "Request access" CTA
 * while a request is open; the server also refuses duplicates.
 */

const TIER_NAME = { shield: 'Shield' };

const STATUS_LABEL: Record<string, string> = {
  // Applicants do not need the received/under-review distinction.
  received: 'Under review',
  under_review: 'Under review',
  more_info_required: 'More information requested',
  approved: 'Approved',
  agreement_accepted: 'Terms accepted',
  payment_pending: 'Payment in progress',
  active: 'Activated',
  declined: 'Not approved',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
  cancelled: 'Cancelled',
  expired: 'Approval expired',
};

const WITHDRAWABLE = new Set([
  'received',
  'under_review',
  'more_info_required',
  'approved',
  'agreement_accepted',
]);

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

export function ApplicationPage() {
  const { state, refresh } = useAccountState();
  const [history, setHistory] = useState<ApplicationSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(() => {
    void listMyApplications()
      .then(setHistory)
      .catch(() => setHistoryError('We couldn’t load your request history.'));
  }, []);
  useEffect(load, [load]);

  const current = state?.application ?? history?.[0] ?? null;
  const policy = state?.requestPolicy;

  async function withdraw() {
    if (!current) return;
    setWithdrawing(true);
    setActionError(undefined);
    try {
      await withdrawApplication(current.id);
      setConfirming(false);
      await refresh();
      load();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status < 500
          ? err.message
          : 'We couldn’t withdraw the request right now. Try again shortly.',
      );
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <AccountLayout context="Access request">
      <section className="ra-flow" aria-labelledby="application-title">
        {!current ? (
          <>
            <h1 id="application-title" className="ra-title">
              Access request
            </h1>
            <p className="ra-lede">
              You haven’t submitted an access request yet.
            </p>
            {state?.routeGroups.includes('request') && (
              <div className="ra-flow__actions">
                <Link
                  to="/access/request"
                  className="ra-button ra-button--primary"
                >
                  Request access
                </Link>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="ra-eyebrow">
              {TIER_NAME[current.tier]} request · {current.reference}
            </p>
            <h1 id="application-title" className="ra-title">
              {STATUS_LABEL[current.status] ?? current.status}
            </h1>
            <Lede application={current} />

            {!['declined', 'withdrawn', 'cancelled', 'superseded'].includes(
              current.status,
            ) && (
              <AccessTracker
                current={stepForStatus(current.status)}
                label="Request status"
              />
            )}

            <dl className="ra-summary">
              <div>
                <dt>Requested access</dt>
                <dd>{TIER_NAME[current.tier]}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{date(current.submittedAt)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[current.status] ?? current.status}</dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{current.organization}</dd>
              </div>
            </dl>

            {current.status === 'more_info_required' &&
              current.infoRequestMessage && (
                <div className="ra-panel" role="note">
                  <p className="ra-panel__head">The review team asked</p>
                  <p className="ra-body">{current.infoRequestMessage}</p>
                  <p className="ra-note">
                    Reply to the email you received from BantAI with the
                    requested details, quoting {current.reference}.
                  </p>
                </div>
              )}

            {actionError && (
              <div className="bantai-auth-card__form-error" role="alert">
                {actionError}
              </div>
            )}

            <div className="ra-flow__actions">
              {state?.routeGroups.includes('activation') && (
                <Link to="/activation" className="ra-button ra-button--primary">
                  Continue activation
                </Link>
              )}
              {state?.routeGroups.includes('workspace') && (
                <Link
                  to="/shield/overview"
                  className="ra-button ra-button--primary"
                >
                  Open Shield
                </Link>
              )}
              {['declined', 'withdrawn', 'cancelled', 'expired'].includes(
                current.status,
              ) &&
                policy?.canRequest && (
                  <Link
                    to="/access/request"
                    className="ra-button ra-button--primary"
                  >
                    Submit a new request
                  </Link>
                )}
              {WITHDRAWABLE.has(current.status) && (
                <button
                  type="button"
                  className="ra-button ra-button--ghost"
                  onClick={() => setConfirming(true)}
                >
                  Withdraw request
                </button>
              )}
            </div>
            {current.status === 'declined' && policy?.eligibleAt && (
              <p className="ra-note">
                You can submit a new request after {date(policy.eligibleAt)}.
              </p>
            )}
          </>
        )}

        {history && history.length > 1 && (
          <section aria-labelledby="history-title">
            <h2 id="history-title" className="ra-panel__head">
              Request history
            </h2>
            <ul className="acct-history">
              {history.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.reference}</strong> · {TIER_NAME[item.tier]}
                  </span>
                  <span className="acct-history__meta">
                    {STATUS_LABEL[item.status] ?? item.status} · submitted{' '}
                    {date(item.submittedAt)}
                    {item.license?.validUntil
                      ? ` · access until ${date(item.license.validUntil)}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {historyError && <p className="ra-note">{historyError}</p>}
      </section>

      <Dialog
        open={confirming}
        title="Withdraw this request?"
        description="The request stays in your history but will no longer be reviewed. You can submit a new one afterwards."
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep request
            </Button>
            <Button
              variant="destructive"
              onClick={() => void withdraw()}
              disabled={withdrawing}
              aria-busy={withdrawing}
            >
              {withdrawing ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </>
        }
      />
    </AccountLayout>
  );
}

function Lede({ application }: { application: ApplicationSummary }) {
  switch (application.status) {
    case 'received':
    case 'under_review':
      return (
        <p className="ra-lede">
          Your request is being reviewed before access can be activated. We’ll
          email you when there is a decision.
        </p>
      );
    case 'more_info_required':
      return (
        <p className="ra-lede">
          Review is paused until the team receives the details below.
        </p>
      );
    case 'approved':
    case 'agreement_accepted':
    case 'payment_pending':
      return (
        <p className="ra-lede">
          Your request was approved. Accept the license terms and complete
          payment to activate access.
        </p>
      );
    case 'declined':
      return (
        <p className="ra-lede">
          This request was not approved. Your account and request history are
          kept.
        </p>
      );
    case 'withdrawn':
      return <p className="ra-lede">You withdrew this request.</p>;
    case 'active':
      return (
        <p className="ra-lede">This request was approved and activated.</p>
      );
    default:
      return null;
  }
}

export default ApplicationPage;
