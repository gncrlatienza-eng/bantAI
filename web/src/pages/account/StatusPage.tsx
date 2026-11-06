import React from 'react';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import '../RequestAccess/request-access.css';

/*
 * StatusPage — suspended or revoked access (spec X). Suspension is not
 * expiry: it is resolved with the BantAI team, so no re-request is offered.
 */

export function StatusPage() {
  const { state } = useAccountState();
  const revoked = state?.state === 'REVOKED';
  const legacyReview = state?.state === 'LEGACY_REVIEW_REQUIRED';
  const workspace = state?.previousAccess?.organizationName;

  return (
    <AccountLayout context="Access">
      <section className="ra-flow" aria-labelledby="status-title">
        <p className="ra-eyebrow">
          {legacyReview
            ? 'Contract review'
            : revoked
              ? 'Access revoked'
              : 'Access suspended'}
        </p>
        <h1 id="status-title" className="ra-title">
          {legacyReview
            ? 'Your previous license needs review'
            : revoked
              ? 'Access to BantAI has been revoked'
              : 'Your BantAI access is paused'}
        </h1>
        <p className="ra-lede">
          {legacyReview
            ? `Your earlier ${state?.previousAccess?.legacyTier?.toLowerCase() ?? 'BantAI'} agreement is being reviewed for Shield access. Payment history is kept, but Shield intelligence remains unavailable until BantAI confirms the contract. Contact BantAI support for an update.`
            : revoked
              ? 'This account can no longer use BantAI intelligence. Contact BantAI support if you believe this is a mistake.'
              : `Licensed intelligence is paused${workspace ? ` for ${workspace}` : ''} because of a billing or administrative issue with the subscription. Contact BantAI support to resolve it; your account and history are kept.`}
        </p>
      </section>
    </AccountLayout>
  );
}

export default StatusPage;
