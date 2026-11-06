import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { useAccountState } from '../../context/AccountStateContext';
import {
  acceptApplicationAgreement,
  startApplicationCheckout,
} from '../../services/accountService';
import {
  reconcileTestCheckout,
  type BillingPeriod,
} from '../../services/authService';
import { AccessTracker, stepForStatus } from '../RequestAccess/accessSteps';
import '../RequestAccess/licensing.css';
import '../RequestAccess/request-access.css';

/*
 * ActivationPage — approved → terms → payment → activation, while signed in
 * (audit §A.1, spec Z/AA). The server refuses checkout until the terms are
 * accepted, and ONLY the verified Stripe webhook activates the license: the
 * return from Stripe just shows "confirming" while the page re-reads the
 * account state. When the license turns active the route guard moves the
 * user into their workspace.
 */

const POLL_MS = 2500;
const PRICE_UNAVAILABLE =
  'The subscription price could not be confirmed right now, so the terms cannot be accepted yet. Please reload this page shortly.';
const POLL_LIMIT = 24;

export function ActivationPage() {
  const location = useLocation();
  const { state, refresh } = useAccountState();
  const application = state?.application ?? null;
  const [returnState] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      checkout: params.get('checkout'),
      sessionId: params.get('session_id'),
    };
  });
  const [confirming, setConfirming] = useState(
    returnState.checkout === 'success',
  );
  const [accepted, setAccepted] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('ANNUAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const polls = useRef(0);

  // Strip Stripe's return parameters from the address bar.
  useEffect(() => {
    if (location.search) window.history.replaceState(null, '', '/activation');
  }, [location.search]);

  // Test mode only: without a webhook listener, ask the backend to verify the
  // session with Stripe (it refuses in production and for live sessions).
  useEffect(() => {
    if (!returnState.sessionId) return;
    void reconcileTestCheckout(returnState.sessionId).catch(() => undefined);
  }, [returnState.sessionId]);

  // While confirming, re-read the account state until the license is active
  // (the guard then redirects) or we stop and explain.
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setInterval(() => {
      polls.current += 1;
      void refresh();
      if (polls.current >= POLL_LIMIT) {
        window.clearInterval(timer);
        setConfirming(false);
        setError(
          'Payment confirmation is taking longer than usual. If you completed payment, your access will activate shortly — you can safely leave this page.',
        );
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [confirming, refresh]);

  async function accept() {
    if (!application) return;
    if (!application.pricing?.confirmed) {
      setError(PRICE_UNAVAILABLE);
      return;
    }
    if (!accepted) {
      setError('Confirm that you accept the license terms to continue.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await acceptApplicationAgreement(
        application.id,
        application.currentAgreementVersion,
      );
      await refresh();
    } catch (err) {
      setError(
        messageFor(err, 'We couldn’t record your acceptance right now.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!application) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await startApplicationCheckout(
        application.id,
        billingPeriod,
      );
      if (result.status === 'open') {
        window.location.assign(result.url);
        return;
      }
      setConfirming(true);
      setBusy(false);
    } catch (err) {
      setError(
        messageFor(err, 'We couldn’t start the secure payment right now.'),
      );
      setBusy(false);
    }
  }

  if (!application) {
    return (
      <AccountLayout context="Activation">
        <p className="ra-lede">Loading your approved request…</p>
      </AccountLayout>
    );
  }

  const scope = application.scope;
  const needsTerms = application.status === 'approved';
  const pricing = application.pricing;
  const priceFor = (period: BillingPeriod) =>
    (period === 'ANNUAL' ? pricing?.annual : pricing?.monthly)?.display ??
    'Price unavailable';

  return (
    <AccountLayout context="Activation">
      <section className="ra-flow" aria-labelledby="activation-title">
        <p className="ra-eyebrow">
          {scope.name} · {application.reference}
        </p>
        <AccessTracker
          current={confirming ? 'access' : stepForStatus(application.status)}
          label="Activation progress"
        />

        {confirming ? (
          <>
            <h1 id="activation-title" className="ra-title">
              Confirming your payment
            </h1>
            <p className="ra-lede" role="status" aria-live="polite">
              We’re waiting for Stripe to confirm payment. Your workspace opens
              automatically once it does.
            </p>
          </>
        ) : needsTerms ? (
          <>
            <h1 id="activation-title" className="ra-title">
              Review your approved access
            </h1>
            <p className="ra-lede">
              These are the exact terms of your license. Nothing is charged at
              this step.
            </p>
            <dl className="ra-summary ra-review">
              <Row label="License" value={scope.name} />
              <Row label="Organization" value={application.organization} />
              <Row label="Purpose" value={scope.purpose} />
              <Row label="Dataset" value={scope.dataset} />
              <Row label="Users" value={scope.users} />
              <Row label="Exports" value={scope.exports} />
              <Row label="API" value={scope.api} />
              <Row label="Redistribution" value={scope.redistribution} />
              <Row label="Re-identification" value={scope.reidentification} />
              <Row label="Term" value={scope.term} />
              <Row label="Annual billing" value={priceFor('ANNUAL')} />
              <Row label="Monthly billing" value={priceFor('MONTHLY')} />
            </dl>
            {pricing?.confirmed ? (
              <p className="ra-note">
                You choose annual or monthly billing on the next step. This is
                the recurring amount Stripe will charge for the period you
                choose, until the subscription is cancelled.
              </p>
            ) : (
              <p className="ra-note" role="alert">
                {PRICE_UNAVAILABLE}
              </p>
            )}
            <label className="ra-check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  setError(undefined);
                }}
              />
              <span>
                I have reviewed and accept the {scope.name} terms (version{' '}
                {application.currentAgreementVersion}) on behalf of{' '}
                {application.organization}.
              </span>
            </label>
            {error && (
              <div className="bantai-auth-card__form-error" role="alert">
                {error}
              </div>
            )}
            <div className="ra-flow__actions">
              <button
                type="button"
                className="ra-button ra-button--primary"
                onClick={() => void accept()}
                disabled={busy || !pricing?.confirmed}
                aria-busy={busy}
              >
                {busy
                  ? 'Recording acceptance…'
                  : 'Accept and continue to payment'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="activation-title" className="ra-title">
              Complete payment to activate BantAI
            </h1>
            {returnState.checkout === 'cancelled' && (
              <p className="ra-note" role="status">
                Payment wasn’t completed. Nothing was charged — you can try
                again below.
              </p>
            )}
            <dl className="ra-summary">
              <Row label="License" value={scope.name} />
              <Row label="Organization" value={application.organization} />
              <Row label="Billing email" value={state?.account?.email ?? '—'} />
              <Row label="Recurring price" value={priceFor(billingPeriod)} />
            </dl>
            <fieldset className="acct-choice">
              <legend className="ra-panel__head">Billing period</legend>
              {(['ANNUAL', 'MONTHLY'] as const).map((period) => (
                <label key={period} className="acct-choice__option">
                  <input
                    type="radio"
                    name="billingPeriod"
                    checked={billingPeriod === period}
                    onChange={() => setBillingPeriod(period)}
                  />
                  <span className="acct-choice__title">
                    {period === 'ANNUAL' ? 'Annual' : 'Monthly'}
                  </span>
                  <span className="acct-choice__body">{priceFor(period)}</span>
                </label>
              ))}
            </fieldset>
            <p className="ra-note" role="note">
              <strong>Test checkout only:</strong> do not enter a real card. Use
              Stripe test Visa 4242 4242 4242 4242, any future expiry date, and
              any three-digit CVC.
            </p>
            {error && (
              <div className="bantai-auth-card__form-error" role="alert">
                {error}
              </div>
            )}
            <div className="ra-flow__actions">
              <button
                type="button"
                className="ra-button ra-button--primary"
                onClick={() => void pay()}
                disabled={busy}
                aria-busy={busy}
              >
                {busy
                  ? 'Opening secure payment…'
                  : 'Continue to secure payment'}
              </button>
            </div>
            <p className="ra-note">
              You’ll continue to Stripe’s secure payment page. Access begins
              only once Stripe confirms payment — not when your browser returns
              here.
            </p>
          </>
        )}
      </section>
    </AccountLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function messageFor(err: unknown, fallback: string) {
  return err instanceof ApiError && err.status < 500
    ? err.message
    : `${fallback} Please try again shortly.`;
}

export default ActivationPage;
