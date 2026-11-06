import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import {
  getApplicationPrefill,
  type ApplicationPrefill,
} from '../../services/accountService';
import {
  AccessRequestWizard,
  RequestStart,
  type WizardPrefill,
} from '../RequestAccess/requestForm';
import { forgetIntendedAccess, readIntendedAccess } from './intendedAccess';
import '../RequestAccess/request-access.css';

/*
 * RequestPage — the signed-in access request (new, again after expiry or a
 * decline, or expiry). The server decides whether another Shield request is
 * available and enforces that decision on submit.
 */

const BLOCKED_COPY: Record<string, string> = {
  OPEN_REQUEST_EXISTS:
    'You already have an access request in progress. Follow it from your request status.',
  LICENSE_SUSPENDED:
    'Your current license is suspended. Resolve it before requesting access again.',
  ALREADY_ACTIVE: 'You already hold an active Shield subscription.',
};

export function RequestPage() {
  const navigate = useNavigate();
  const { state, refresh } = useAccountState();
  const policy = state?.requestPolicy;
  const requestable = useMemo(
    () => policy?.requestableTiers ?? [],
    [policy?.requestableTiers],
  );
  const [prefill, setPrefill] = useState<ApplicationPrefill | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [view, setView] = useState<'start' | 'form'>('start');
  const intended = readIntendedAccess();

  useEffect(() => {
    void getApplicationPrefill()
      .then(setPrefill)
      .catch(() =>
        setLoadError('We couldn’t load your details. Reload to try again.'),
      );
  }, []);

  // The server remains the source of truth for whether Shield is requestable.
  useEffect(() => {
    if (prefill && requestable.includes('shield')) setView('start');
  }, [prefill, requestable]);

  const returning = Boolean(prefill?.previous);
  const wizardPrefill: WizardPrefill = useMemo(() => {
    const fields = prefill?.fields;
    if (!fields) return {};
    return {
      fullName: fields.fullName ?? undefined,
      applicantRole: fields.applicantRole ?? undefined,
      organization: fields.organization ?? undefined,
      expectedUsers: fields.expectedUsers
        ? String(fields.expectedUsers)
        : undefined,
      ...(fields.organizationDetails
        ? {
            website: fields.organizationDetails.website ?? undefined,
            contactPerson:
              fields.organizationDetails.contactPerson ?? undefined,
          }
        : {}),
    };
  }, [prefill]);

  const title = returning ? 'Request access again' : 'Request access';

  if (policy && !policy.canRequest) {
    const eligible = policy.eligibleAt
      ? `You can submit a new request after ${new Date(policy.eligibleAt).toLocaleDateString()}.`
      : null;
    return (
      <AccountLayout context="Access request">
        <section className="ra-flow" aria-labelledby="request-blocked">
          <h1 id="request-blocked" className="ra-title">
            {title}
          </h1>
          <p className="ra-lede">
            {eligible ??
              BLOCKED_COPY[policy.blockedReason ?? ''] ??
              'A new request isn’t available for this account right now.'}
          </p>
          <div className="ra-flow__actions">
            <Link to="/application" className="ra-button ra-button--primary">
              View request status
            </Link>
          </div>
        </section>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout context="Access request">
      {loadError && (
        <div className="bantai-auth-card__form-error" role="alert">
          {loadError}
        </div>
      )}

      {!loadError && !prefill && <p className="ra-lede">Loading…</p>}

      {prefill && view === 'start' && (
        <RequestStart
          tier="shield"
          previousReference={prefill.previous?.reference}
          onBegin={() => setView('form')}
        />
      )}

      {prefill && view === 'form' && (
        <AccessRequestWizard
          tier="shield"
          initialPilot={Boolean(intended?.pilot)}
          accountEmail={prefill.email ?? state?.account?.email ?? ''}
          prefill={wizardPrefill}
          previousReference={prefill.previous?.reference}
          onBack={() => setView('start')}
          onSubmitted={() => {
            forgetIntendedAccess();
            // Every post-submit state (pending, or active with an upgrade in
            // review) may reach the status page.
            void refresh().then(() =>
              navigate('/application', { replace: true }),
            );
          }}
        />
      )}
    </AccountLayout>
  );
}

export default RequestPage;
