import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccountState } from '../../context/AccountStateContext';
import {
  requestPortalEmailOtp,
  verifyPortalEmailOtp,
} from '../../services/authService';
import { Input } from '../common/Input';

/*
 * LoginForm — one calm, unified sign-in with three factors: email, password,
 * and a Gmail-delivered OTP.
 *
 * Stage 1 — the visitor enters their email + password. The backend
 * validates both and sends an OTP for any BantAI web account that is not
 * suspended. A license is NOT required: authentication proves identity only.
 * There is no admin/client toggle and no admin-specific route.
 *
 * Stage 2 — the user enters the 6-digit code sent to their inbox. The
 * challenge is single-use and expires in 5 minutes. On success the server
 * resolves the account lifecycle state (admin, setup, pending, active,
 * expired…) and we go to its single allowed destination.
 *
 * Backend rejections are rewritten into plain next-step copy by
 * friendlyError(); the OTP screen masks the address it echoes back.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;
const MIN_PASSWORD_LEN = 8;

const CODE_RESENT_MESSAGE =
  'A new code is on its way. It expires in 5 minutes.';
const CREDENTIALS_FAILURE = 'Email or password is incorrect.';
const VERIFY_FAILURE =
  'That code is incorrect or has expired. Check it or resend a new one.';
const NETWORK_FAILURE =
  "We couldn't reach the sign-in service. Please try again in a moment.";

type Stage = 'email' | 'otp';

/*
 * Translate backend/transport errors into plain next-step copy. Known
 * backend messages are rewritten; anything else that is already human text
 * (e.g. the OTP rate-limit notice) passes through; transport failures and
 * bare "HTTP 500: …" strings fall back to the network message.
 */
function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return NETWORK_FAILURE;
  const msg = err.message;
  if (/failed to fetch|networkerror|^HTTP \d+/i.test(msg)) {
    return NETWORK_FAILURE;
  }
  if (/invalid email or password/i.test(msg)) return CREDENTIALS_FAILURE;
  if (/invalid or expired otp/i.test(msg)) return VERIFY_FAILURE;
  return msg;
}

/* r•••••@organization.com — confirms the address without echoing it whole. */
function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return value;
  return `${local[0]}${'•'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { refresh } = useAccountState();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  useEffect(() => {
    if (stage === 'otp') {
      const input =
        document.querySelector<HTMLInputElement>('input[name="otp"]');
      input?.focus();
    }
  }, [stage]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setNotice(undefined);

    const trimmedEmail = email.trim();
    let hasError = false;
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.');
      hasError = true;
    }
    if (!password || password.length < MIN_PASSWORD_LEN) {
      setPasswordError('Enter your password.');
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      await requestPortalEmailOtp(trimmedEmail, password);
      setStage('otp');
    } catch (err) {
      // Surface the backend's real 401/403 reason on the form so the user
      // knows the credentials were wrong (rather than being sent to an OTP
      // step that will never verify).
      setFormError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(undefined);
    setFormError(undefined);

    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!OTP_RE.test(trimmedOtp)) {
      setOtpError('Enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    try {
      await verifyPortalEmailOtp(trimmedEmail, trimmedOtp);
      const state = await refresh();
      if (!state) throw new Error(NETWORK_FAILURE);
      void navigate(state.destination, { replace: true });
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setFormError(undefined);
    setOtpError(undefined);
    setNotice(undefined);
    setResending(true);
    try {
      // Resend re-uses the same password the user entered at stage 1. If the
      // password has since been rotated, this will silently fall into the
      // generic "code sent" no-op and the user will eventually notice no
      // email arriving — expected behavior.
      await requestPortalEmailOtp(email.trim(), password);
      setNotice(CODE_RESENT_MESSAGE);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setResending(false);
    }
  }

  function handleUseDifferentEmail() {
    setStage('email');
    setPassword('');
    setOtp('');
    setOtpError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setNotice(undefined);
  }

  if (stage === 'email') {
    return (
      <>
        <CardHeader
          eyebrow="Sign in"
          title="Welcome back"
          subtitle="Sign in to your BantAI account to continue."
        />
        <form
          className="bantai-auth-card__form"
          onSubmit={(e) => void handleRequestOtp(e)}
          noValidate
        >
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(undefined);
              setFormError(undefined);
            }}
            error={emailError}
            autoFocus
            required
          />

          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            isPassword
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(undefined);
              setFormError(undefined);
            }}
            error={passwordError}
            labelAction={
              <button
                type="button"
                className="bantai-auth-card__label-action"
                aria-expanded={showResetHelp}
                aria-controls="login-reset-help"
                onClick={() => setShowResetHelp((v) => !v)}
              >
                Forgot password?
              </button>
            }
            required
          />

          {/* There is no self-service reset yet (/forgot-password redirects
            back here), so say plainly who can reset it. */}
          {showResetHelp && (
            <p
              id="login-reset-help"
              className="bantai-auth-card__hint"
              role="status"
            >
              Password resets are handled by your BantAI administrator. Contact
              them to reset your workspace password.
            </p>
          )}

          {formError && (
            <div
              className="bantai-auth-card__form-error"
              role="alert"
              aria-live="polite"
            >
              {formError}
            </div>
          )}

          <div className="bantai-auth-card__actions">
            <button
              type="submit"
              className="bantai-auth-card__primary"
              disabled={loading}
              aria-busy={loading}
            >
              {loading && (
                <span className="bantai-auth-card__spinner" aria-hidden />
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>

          <p className="bantai-auth-card__foot">
            New to BantAI? <Link to="/signup">Create an account</Link>
          </p>
        </form>
      </>
    );
  }

  return (
    <>
      <CardHeader
        eyebrow="Verify"
        title="Check your email"
        subtitle={
          <>
            We sent a 6-digit verification code to{' '}
            <span className="bantai-auth-card__email-echo">
              {maskEmail(email.trim())}
            </span>
            .
          </>
        }
      />
      <form
        className="bantai-auth-card__form"
        onSubmit={(e) => void handleVerifyOtp(e)}
        noValidate
      >
        {/* Only speaks up after "Resend code" — the header already explains
          the first send. */}
        <p
          className="bantai-auth-card__notice"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>

        <Input
          label="Verification code"
          type="text"
          name="otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="••••••"
          maxLength={6}
          className="bantai-auth-card__otp"
          value={otp}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D+/g, '').slice(0, 6);
            setOtp(digits);
            setOtpError(undefined);
            setFormError(undefined);
          }}
          error={otpError}
          helpText="Six-digit code — expires in 5 minutes."
          required
        />

        {formError && (
          <div
            className="bantai-auth-card__form-error"
            role="alert"
            aria-live="polite"
          >
            {formError}
          </div>
        )}

        <div className="bantai-auth-card__actions">
          <button
            type="submit"
            className="bantai-auth-card__primary"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && (
              <span className="bantai-auth-card__spinner" aria-hidden />
            )}
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>

        <div
          className="bantai-auth-card__foot"
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
        >
          <button
            type="button"
            className="bantai-auth-card__link"
            onClick={() => void handleResendOtp()}
            disabled={resending}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: resending ? 'default' : 'pointer',
              color: 'inherit',
              textDecoration: 'underline',
            }}
          >
            {resending ? 'Resending…' : 'Resend code'}
          </button>
          <button
            type="button"
            className="bantai-auth-card__link"
            onClick={handleUseDifferentEmail}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Back to sign in
          </button>
        </div>
      </form>
    </>
  );
};

/* Card heading — changes with the stage so each step explains itself only
   when it becomes relevant. */
function CardHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="bantai-auth-card__header">
      <p className="bantai-auth-card__eyebrow">{eyebrow}</p>
      <h1 className="bantai-auth-card__title">{title}</h1>
      <p className="bantai-auth-card__subtitle">{subtitle}</p>
    </div>
  );
}
