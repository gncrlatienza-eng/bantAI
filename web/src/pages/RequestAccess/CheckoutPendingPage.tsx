import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import {
  requestClientClaimEmailOtp,
  verifyClientClaimEmailOtp,
} from '../../services/authService';
import './licensing.css';

/*
 * CheckoutPendingPage — the Stripe success_url lands here. The page does NOT
 * grant access; it merely reports that Stripe accepted the payment and that
 * the backend will activate the license once the signed webhook fires.
 *
 * The Stripe cancel_url uses this same layout with a different message
 * (see CheckoutCancelledPage) so both post-checkout outcomes look consistent.
 */
export function CheckoutPendingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const checkoutSessionId = params.get('session_id') ?? '';
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function requestCode() {
    setLoading(true);
    setError(undefined);
    try {
      await requestClientClaimEmailOtp(email.trim(), checkoutSessionId);
      setCodeRequested(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The verification code could not be sent.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function claimAccount() {
    setLoading(true);
    setError(undefined);
    try {
      await verifyClientClaimEmailOtp(email.trim(), checkoutSessionId, otp);
      void navigate('/client/overview');
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'The verification code is invalid or the license is not active yet.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout decor="paused">
      <div className="licensing-confirm">
        <span className="bantai-auth-card__status">
          <span
            className="bantai-auth-card__status-dot"
            data-tone="verified"
            aria-hidden
          />
          Payment received · waiting on confirmation
        </span>
        <header>
          <p className="licensing__eyebrow">Checkout</p>
          <h1 className="licensing__title">
            Thanks — Stripe accepted your payment.
          </h1>
        </header>
        <p className="licensing__lede">
          Your license will activate as soon as Stripe’s signed webhook reaches
          BantAI. This is usually near-instant, but access is not granted by
          this page alone — the webhook is the only signal we trust to flip a
          license to <strong>Active</strong>.
        </p>
        <p className="licensing__lede">
          You will receive a confirmation email once your license is active.
        </p>
        {checkoutSessionId && (
          <div className="licensing-form__form">
            <label>
              Billing email
              <input
                type="email"
                autoComplete="email"
                value={email}
                disabled={loading || codeRequested}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {codeRequested && (
              <label>
                6-digit verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
              </label>
            )}
            {error && (
              <div className="bantai-auth-card__form-error" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              className="bantai-auth-card__primary"
              disabled={
                loading || !email.trim() || (codeRequested && otp.length !== 6)
              }
              onClick={() =>
                void (codeRequested ? claimAccount() : requestCode())
              }
            >
              {loading
                ? 'Checking…'
                : codeRequested
                  ? 'Activate account'
                  : 'Email my activation code'}
            </button>
            <p className="licensing-form__actions-helper">
              If Stripe has not finished activating the license yet, wait a
              moment and try again.
            </p>
          </div>
        )}
        <div className="licensing-form__actions licensing-confirm__actions">
          <Link to="/" className="bantai-auth-card__primary">
            Back to website
          </Link>
          <Link to="/login" className="bantai-auth-card__link">
            Return to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export function CheckoutCancelledPage() {
  return (
    <AuthLayout decor="paused">
      <div className="licensing-confirm">
        <span className="bantai-auth-card__status">
          <span className="bantai-auth-card__status-dot" aria-hidden />
          Checkout cancelled
        </span>
        <header>
          <p className="licensing__eyebrow">Checkout</p>
          <h1 className="licensing__title">
            You cancelled the secure payment.
          </h1>
        </header>
        <p className="licensing__lede">
          No payment was taken. Your approval is still valid — reopen the link
          from your approval email whenever you’re ready to continue.
        </p>
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

export default CheckoutPendingPage;
