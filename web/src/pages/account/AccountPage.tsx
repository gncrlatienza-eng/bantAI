import React from 'react';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import type { AccountLifecycleState } from '../../services/accountService';
import '../RequestAccess/request-access.css';

/* AccountPage — who you are and where your access stands. */

const STATE_LABEL: Partial<Record<AccountLifecycleState, string>> = {
  READY_TO_REQUEST: 'No access requested yet',
  APPLICATION_PENDING: 'Request under review',
  APPLICATION_DECLINED: 'Request not approved',
  APPROVED_TERMS_REQUIRED: 'Approved — terms to accept',
  APPROVED_PAYMENT_REQUIRED: 'Approved — payment to complete',
  ACTIVE_SHIELD: 'Shield access active',
  EXPIRED_SHIELD: 'Shield access ended',
  LEGACY_REVIEW_REQUIRED: 'Previous license under review',
  SUSPENDED: 'Access paused',
};

export function AccountPage() {
  const { state } = useAccountState();
  const account = state?.account;
  const name = [account?.firstName, account?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <AccountLayout context="Account">
      <section className="ra-flow" aria-labelledby="account-title">
        <h1 id="account-title" className="ra-title">
          Account
        </h1>
        <dl className="ra-summary">
          <div>
            <dt>Name</dt>
            <dd>{name || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{account?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Affiliation</dt>
            <dd>{account?.organization ?? '—'}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{(state && STATE_LABEL[state.state]) ?? '—'}</dd>
          </div>
          {state?.workspace && (
            <div>
              <dt>Workspace</dt>
              <dd>
                {state.workspace.name}
                {state.workspace.validUntil
                  ? ` · until ${new Date(state.workspace.validUntil).toLocaleDateString()}`
                  : ''}
              </dd>
            </div>
          )}
        </dl>
        <p className="ra-note">
          Your account stays yours when a license ends, so you can request
          access again without creating a new one.
        </p>
      </section>
    </AccountLayout>
  );
}

export default AccountPage;
