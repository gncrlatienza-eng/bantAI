import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { Input } from '../../components/common/Input';
import { useAccountState } from '../../context/AccountStateContext';
import { requestSignUpOtp, verifySignUp } from '../../services/authService';
import {
  readIntendedAccess,
  rememberIntendedAccess,
  tierFromQuery,
} from './intendedAccess';

/*
 * SignUpPage — account-first registration (audit §A.1). The account exists
 * before any access request, so identity is independent of licensing.
 *
 *   1. Email — a code is sent only if no account uses this email yet; an
 *      existing account is directed to sign in.
 *   2. Code + password — proves the email and creates the account, then the
 *      server-resolved destination (mandatory setup) takes over.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const TIER_LABEL = { shield: 'Shield' };

export function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAccountState();
  const [stage, setStage] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  const queryTier = tierFromQuery(location.search);
  const intended = queryTier ?? readIntendedAccess()?.tier ?? null;
  useEffect(() => {
    if (queryTier && readIntendedAccess()?.tier !== queryTier) {
      rememberIntendedAccess({ tier: queryTier, pilot: false });
    }
  }, [queryTier]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setErrors({});
    setFormError(undefined);
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setBusy(true);
    try {
      await requestSignUpOtp(email.trim());
      setStage('verify');
      setNotice(
        stage === 'verify'
          ? 'If this email can be registered, a new code is on its way.'
          : undefined,
      );
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^\d{6}$/.test(otp))
      next.otp = 'Enter the 6-digit code from your email.';
    if (password.length < MIN_PASSWORD)
      next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setFormError(undefined);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await verifySignUp(email.trim(), otp, password);
      const state = await refresh();
      void navigate(state?.destination ?? '/setup', { replace: true });
    } catch (err) {
      setFormError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="bantai-auth-card">
        <div className="bantai-auth-card__header">
          <p className="bantai-auth-card__eyebrow">
            {intended ? `${TIER_LABEL[intended]} access` : 'Create account'}
          </p>
          <h1 className="bantai-auth-card__title">
            {stage === 'email'
              ? 'Create your BantAI account'
              : 'Check your email'}
          </h1>
          <p className="bantai-auth-card__subtitle">
            {stage === 'email'
              ? 'Your account comes first. You’ll finish setup, then submit your access request for review. No payment is taken now.'
              : `If ${email.trim()} can be registered, we sent it a 6-digit code. Enter it and choose a password.`}
          </p>
        </div>

        {stage === 'email' ? (
          <form
            className="bantai-auth-card__form"
            onSubmit={(e) => void sendCode(e)}
            noValidate
          >
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
                setFormError(undefined);
              }}
              error={errors.email}
              helpText="Use your organization email address when available."
              autoFocus
              required
            />
            {formError && (
              <div className="bantai-auth-card__form-error" role="alert">
                {formErrorContent(formError)}
              </div>
            )}
            <div className="bantai-auth-card__actions">
              <button
                type="submit"
                className="bantai-auth-card__primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Sending code…' : 'Send verification code'}
              </button>
            </div>
            <p className="bantai-auth-card__foot">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </form>
        ) : (
          <form
            className="bantai-auth-card__form"
            onSubmit={(e) => void createAccount(e)}
            noValidate
          >
            <p
              className="bantai-auth-card__notice"
              role="status"
              aria-live="polite"
            >
              {notice}
            </p>
            <Input
              label="Verification code"
              name="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="bantai-auth-card__otp"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D+/g, '').slice(0, 6));
                setErrors((x) => ({ ...x, otp: undefined }));
              }}
              error={errors.otp}
              helpText="Six-digit code — expires in 5 minutes."
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              name="new-password"
              autoComplete="new-password"
              isPassword
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: undefined }));
              }}
              error={errors.password}
              helpText={`At least ${MIN_PASSWORD} characters.`}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              isPassword
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((x) => ({ ...x, confirm: undefined }));
              }}
              error={errors.confirm}
              required
            />
            {formError && (
              <div className="bantai-auth-card__form-error" role="alert">
                {formErrorContent(formError)}
              </div>
            )}
            <div className="bantai-auth-card__actions">
              <button
                type="submit"
                className="bantai-auth-card__primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </div>
            <div
              className="bantai-auth-card__foot"
              style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
            >
              <button
                type="button"
                className="bantai-auth-card__label-action"
                onClick={() => void sendCode()}
                disabled={busy}
              >
                Resend code
              </button>
              <button
                type="button"
                className="bantai-auth-card__label-action"
                onClick={() => {
                  setStage('email');
                  setOtp('');
                  setPassword('');
                  setConfirm('');
                  setFormError(undefined);
                  setNotice(undefined);
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (/invalid or expired otp/i.test(err.message)) {
      return 'That code is incorrect or has expired. Check it or resend a new one.';
    }
    if (err.status < 500) return err.message;
  }
  return 'We couldn’t reach BantAI right now. Please try again in a moment.';
}

function formErrorContent(error: string): React.ReactNode {
  const signInSuffix = /\s*sign in instead\.?$/i;
  if (!signInSuffix.test(error)) return error;
  return (
    <>
      {error.replace(signInSuffix, '')}{' '}
      <Link to="/login">Sign in instead.</Link>
    </>
  );
}

export default SignUpPage;
