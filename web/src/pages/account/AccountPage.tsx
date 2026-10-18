import React from 'react';
import { Navigate } from 'react-router-dom';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import type {
  AccountLifecycleState,
  AccountState,
} from '../../services/accountService';
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

/** Who the account is and where its access stands, as label/value rows. */
export function accountSummary(
  state: AccountState | null,
): Array<{ label: string; value: string }> {
  const account = state?.account;
  const name = [account?.firstName, account?.lastName]
    .filter(Boolean)
    .join(' ');
  const rows = [
    { label: 'Name', value: name || '—' },
    { label: 'Email', value: account?.email ?? '—' },
    { label: 'Affiliation', value: account?.organization ?? '—' },
    {
      label: 'Access',
      value: (state && STATE_LABEL[state.state]) ?? '—',
    },
  ];
  if (state?.workspace) {
    const until = state.workspace.validUntil
      ? ` · until ${new Date(state.workspace.validUntil).toLocaleDateString()}`
      : '';
    rows.push({ label: 'Workspace', value: state.workspace.name + until });
  }
  return rows;
}

export function AccountPage() {
  const { state } = useAccountState();

  // With Shield active, Account opens inside the Shield portal.
  if (state?.routeGroups.includes('workspace')) {
    return <Navigate to="/shield/account" replace />;
  }

  return (
    <AccountLayout context="Account">
      <section className="ra-flow" aria-labelledby="account-title">
        <h1 id="account-title" className="ra-title">
          Account
        </h1>
        <dl className="ra-summary">
          {accountSummary(state).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
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
