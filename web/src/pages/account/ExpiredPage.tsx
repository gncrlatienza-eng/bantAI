import React from 'react';
import { Link } from 'react-router-dom';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import '../RequestAccess/request-access.css';

/*
 * ExpiredPage — an account lifecycle state, not an error (spec S/BQ).
 * Expired access is not expired identity: the same account requests again,
 * and the new request is linked to this history for review. Nothing
 * reactivates automatically.
 */

const TIER_NAME = { shield: 'Shield' };

export function ExpiredPage() {
  const { state } = useAccountState();
  const previous = state?.previousAccess;
  const policy = state?.requestPolicy;
  const ended = previous?.validUntil
    ? new Date(previous.validUntil).toLocaleDateString()
    : null;

  return (
    <AccountLayout context="Access">
      <section className="ra-flow" aria-labelledby="expired-title">
        <p className="ra-eyebrow">Access expired</p>
        <h1 id="expired-title" className="ra-title">
          Your BantAI access has ended
        </h1>
        <p className="ra-lede">
          {ended
            ? `Your previous access ended on ${ended}.`
            : 'Your previous access is no longer active.'}{' '}
          Your account, request history, and workspace records are kept. To
          continue using BantAI, submit a new request for review.
        </p>

        {previous && (
          <dl className="ra-summary">
            <div>
              <dt>Previous access</dt>
              <dd>{TIER_NAME[previous.tier]}</dd>
            </div>
            <div>
              <dt>Access period</dt>
              <dd>
                {new Date(previous.validFrom).toLocaleDateString()} –{' '}
                {ended ?? 'ended'}
              </dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{previous.organizationName}</dd>
            </div>
          </dl>
        )}

        <div className="ra-flow__actions">
          {policy?.canRequest && (
            <Link to="/access/request" className="ra-button ra-button--primary">
              Request access again
            </Link>
          )}
          <Link to="/application" className="ra-button ra-button--ghost">
            Previous request details
          </Link>
        </div>
      </section>
    </AccountLayout>
  );
}

export default ExpiredPage;
