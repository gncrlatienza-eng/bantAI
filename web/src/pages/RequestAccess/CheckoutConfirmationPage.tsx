import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import {
  createCheckoutSession,
  getAccessRequestByToken,
  type ApprovedAccessRequest,
  type BillingPeriod,
} from '../../services/authService';
import './licensing.css';

/*
 * CheckoutConfirmationPage — the "Continue to secure payment" screen an
 * approved applicant reaches from the emailed link. Renders the approved
 * license, price and billing period, then hands off to Stripe Checkout.
 *
 * Access is NEVER activated by this page or by the browser reaching the
 * Stripe success URL. The Stripe webhook is the only signal that flips a
 * license to ACTIVE.
 */

const PRICE_LABEL: Record<string, Record<BillingPeriod, string>> = {
  RESEARCH: { ANNUAL: '₱24,900 / year', MONTHLY: '₱2,490 / month' },
  ORGANIZATION: { ANNUAL: '₱299,000 / year', MONTHLY: '₱29,900 / month' },
};

const TIER_LABEL: Record<string, string> = {
  RESEARCH: 'Research license',
  ORGANIZATION: 'Organization license',
};

export function CheckoutConfirmationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [record, setRecord] = useState<ApprovedAccessRequest | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('ANNUAL');
  const [checkoutError, setCheckoutError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('This checkout link is missing its approval token.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await getAccessRequestByToken(token);
        if (!cancelled) setRecord(r);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'This approval link is invalid or expired.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleContinue() {
    setCheckoutError(undefined);
    setLoading(true);
    try {
      const { url } = await createCheckoutSession(token, billingPeriod);
      // Full-page navigate — Stripe hosts the checkout.
      window.location.assign(url);
    } catch (err) {
      const message =
        err instanceof Error &&
        !/failed to fetch|networkerror/i.test(err.message)
          ? err.message
          : 'We couldn’t start the secure payment right now. Please try again shortly.';
      setCheckoutError(message);
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <AuthLayout decor="paused">
        <div className="licensing-confirm">
          <span className="bantai-auth-card__status">
            <span className="bantai-auth-card__status-dot" aria-hidden />
            Link problem
          </span>
          <h1 className="licensing__title">
            Your approval link couldn’t be verified.
          </h1>
          <p className="licensing__lede">{loadError}</p>
          <div className="licensing-form__actions licensing-confirm__actions">
            <Link to="/request-access" className="bantai-auth-card__primary">
              Back to licensing
            </Link>
            <Link to="/" className="bantai-auth-card__link">
              Back to website
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!record) {
    return (
      <AuthLayout decor="paused">
        <div className="licensing-confirm">
          <p className="licensing__eyebrow">Checkout</p>
          <p className="licensing__lede">Loading your approved license…</p>
        </div>
      </AuthLayout>
    );
  }

  const price =
    PRICE_LABEL[record.tier]?.[billingPeriod] ?? 'Price not configured';

  return (
    <AuthLayout decor="paused">
      <div className="licensing-confirm">
        <span className="bantai-auth-card__status">
          <span
            className="bantai-auth-card__status-dot"
            data-tone="verified"
            aria-hidden
          />
          Approved · ready to pay
        </span>

        <header>
          <p className="licensing__eyebrow">Checkout</p>
          <h1 className="licensing__title">
            Continue to secure payment for your{' '}
            {TIER_LABEL[record.tier].toLowerCase()}.
          </h1>
        </header>

        <dl className="bantai-auth-card__meta">
          <div>
            <dt>License</dt>
            <dd>{TIER_LABEL[record.tier]}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{record.organization}</dd>
          </div>
          <div>
            <dt>Billing email</dt>
            <dd>{record.email}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{price}</dd>
          </div>
        </dl>

        <fieldset className="licensing-form__form">
          <legend className="licensing__section-eyebrow">Billing period</legend>
          <label className="licensing-form__radio">
            <input
              type="radio"
              name="billingPeriod"
              value="ANNUAL"
              checked={billingPeriod === 'ANNUAL'}
              onChange={() => setBillingPeriod('ANNUAL')}
            />
            <span>Annual — {PRICE_LABEL[record.tier]?.ANNUAL}</span>
          </label>
          <label className="licensing-form__radio">
            <input
              type="radio"
              name="billingPeriod"
              value="MONTHLY"
              checked={billingPeriod === 'MONTHLY'}
              onChange={() => setBillingPeriod('MONTHLY')}
            />
            <span>Monthly — {PRICE_LABEL[record.tier]?.MONTHLY}</span>
          </label>
        </fieldset>

        {checkoutError && (
          <div
            className="bantai-auth-card__form-error"
            role="alert"
            aria-live="polite"
          >
            {checkoutError}
          </div>
        )}

        <div className="licensing-form__actions">
          <button
            type="button"
            className="bantai-auth-card__primary"
            onClick={() => void handleContinue()}
            disabled={loading}
            aria-disabled={loading}
          >
            {loading ? 'Opening secure payment…' : 'Continue to secure payment'}
          </button>
          <p className="licensing-form__actions-helper">
            Payment is processed by Stripe. You will return to BantAI after
            checkout. Your license activates only after Stripe confirms the
            payment — not simply because your browser reaches a success URL.
          </p>
        </div>

        <p className="licensing-form__return">
          <Link to="/">Back to website</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default CheckoutConfirmationPage;
