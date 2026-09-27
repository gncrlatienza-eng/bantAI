import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  requestClientEmailOtp,
  verifyClientEmailOtp,
} from '../../services/authService';
import { useTimer } from '../../hooks/useTimer';
import { Input } from '../common/Input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ClientLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { formattedTime, isExpired, resetTimer } = useTimer(300);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setEmailError(undefined);
    setFormError(undefined);

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError('Enter a valid work email.');
      return;
    }

    setLoading(true);
    try {
      await requestClientEmailOtp(trimmedEmail);
      setEmail(trimmedEmail);
      setOtp(Array(6).fill(''));
      setStep('otp');
      resetTimer(300);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'The verification code could not be sent.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setFormError('Enter all 6 digits of the verification code.');
      return;
    }
    setLoading(true);
    setFormError(undefined);
    try {
      await verifyClientEmailOtp(email, code);
      void navigate('/client/overview');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Invalid verification code.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <form
        className="bantai-auth-card__form"
        onSubmit={(e) => void verifyCode(e)}
        noValidate
      >
        <p className="bantai-auth-card__foot">
          Enter the 6-digit code sent to <strong>{email}</strong>. Expires in{' '}
          <span aria-live="polite">{formattedTime}</span>.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              aria-label={`Verification digit ${index + 1}`}
              autoFocus={index === 0}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={(event) => {
                if (!/^\d*$/.test(event.target.value)) return;
                const next = [...otp];
                next[index] = event.target.value.slice(-1);
                setOtp(next);
                setFormError(undefined);
                if (event.target.value && index < 5)
                  inputRefs.current[index + 1]?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !digit && index > 0)
                  inputRefs.current[index - 1]?.focus();
              }}
              onPaste={(event) => {
                event.preventDefault();
                const value = event.clipboardData.getData('text').trim();
                if (/^\d{6}$/.test(value)) setOtp(value.split(''));
              }}
              style={{
                width: 44,
                height: 52,
                textAlign: 'center',
                fontSize: '1.4rem',
              }}
            />
          ))}
        </div>
        {formError && (
          <div className="bantai-auth-card__form-error" role="alert">
            {formError}
          </div>
        )}
        <div className="bantai-auth-card__actions">
          <button
            className="bantai-auth-card__primary"
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? 'Verifying…' : 'Verify & sign in'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="bantai-auth-card__link"
            disabled={loading || !isExpired}
            onClick={() => void requestCode()}
          >
            Resend code
          </button>
          <button
            type="button"
            className="bantai-auth-card__link"
            onClick={() => setStep('email')}
          >
            Use another email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="bantai-auth-card__form"
      onSubmit={(e) => void requestCode(e)}
      noValidate
    >
      <Input
        label="Work email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="name@organization.com"
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
          aria-disabled={loading}
        >
          {loading ? 'Sending code…' : 'Send verification code'}
        </button>
      </div>

      <p className="bantai-auth-card__foot">
        Need access? <Link to="/request-access">Request access →</Link>
      </p>
    </form>
  );
};
