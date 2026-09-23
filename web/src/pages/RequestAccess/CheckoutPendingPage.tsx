import React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/appshell/AuthLayout';
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
