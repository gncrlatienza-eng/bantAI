/*
 * Shield → Account (avatar menu). The same account summary as /account,
 * shown inside the Shield portal so an active subscriber never leaves it.
 */

import React from 'react';
import { PageHeader } from '../../components/appshell/AppShell';
import { useAccountState } from '../../context/AccountStateContext';
import { accountSummary } from '../account/AccountPage';

export function AccountPage() {
  const { state } = useAccountState();
  return (
    <>
      <PageHeader
        title="Account"
        description="Your account stays yours when a license ends, so you can request access again without creating a new one."
      />
      <dl className="bantai-summary">
        {accountSummary(state).map((row) => (
          <div key={row.label} className="bantai-summary__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export default AccountPage;
