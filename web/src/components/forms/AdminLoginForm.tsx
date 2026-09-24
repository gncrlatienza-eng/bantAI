import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminAuthenticateStaff,
  adminVerifyMfa,
  requestStaffMfa,
  logout,
  type CurrentUser,
} from '../../services/authService';
import { useTimer } from '../../hooks/useTimer';
import { Input } from '../common/Input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AdminLoginForm: React.FC = () => {
  const navigate = useNavigate();

  // Step 1: Staff Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // Step 2: MFA state
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffUser, setStaffUser] = useState<CurrentUser | null>(null);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { formattedTime, isExpired, resetTimer } = useTimer(300);

  // Step 1 Submission
  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);

    const trimmedEmail = email.trim();
    let hasError = false;

    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError('Enter a valid staff email address.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Enter your staff password.');
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      const authResult = await adminAuthenticateStaff(trimmedEmail, password);
      setStaffEmail(authResult.email || trimmedEmail);
      if (authResult.user) setStaffUser(authResult.user);
      setStep('mfa');
      resetTimer(300);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Administrator authentication failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 2 MFA Inputs
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setMfaError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleResendMfa = async () => {
    const targetEmail = staffEmail || email.trim();
    if (!targetEmail) {
      setMfaError('No staff email registered for MFA.');
      return;
    }
    try {
      await requestStaffMfa(targetEmail);
      resetTimer(300);
      setResendNotice(
        'A new verification code has been dispatched to your email.',
      );
    } catch (err) {
      setMfaError(
        err instanceof Error
          ? err.message
          : 'Could not resend MFA verification code.',
      );
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join('');

    if (fullCode.length < 6) {
      setMfaError('Enter all 6 digits of the MFA verification code.');
      return;
    }

    setLoading(true);
    setMfaError(null);
    try {
      const targetEmail = staffEmail || email.trim();
      await adminVerifyMfa(targetEmail, fullCode);
      void navigate('/admin/overview');
    } catch (err) {
      setMfaError(
        err instanceof Error ? err.message : 'Invalid MFA verification code.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    logout();
    setStep('credentials');
    setOtp(Array(6).fill(''));
    setMfaError(null);
    setFormError(undefined);
  };

  if (step === 'mfa') {
    return (
      <form
        className="bantai-auth-card__form"
        onSubmit={(e) => void handleMfaSubmit(e)}
        noValidate
      >
        <div style={{ marginBottom: 12 }}>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              margin: '0 0 12px 0',
            }}
          >
            Staff MFA challenge for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {staffEmail || staffUser?.email || email}
            </strong>
            . Enter the 6-digit security code sent to your Gmail/work email.
          </p>
          <div
            style={{
              fontSize: '0.85rem',
              color: isExpired
                ? 'var(--status-critical)'
                : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Expires in: {formattedTime}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            margin: '16px 0',
          }}
        >
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              onPaste={handleOtpPaste}
              disabled={loading}
              style={{
                width: 44,
                height: 52,
                fontSize: '1.4rem',
                textAlign: 'center',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
                borderRadius: 6,
                border: mfaError
                  ? '1px solid var(--status-critical, #dc2626)'
                  : '1px solid var(--border-default)',
                background: 'var(--surface-input, #fff)',
                color: 'var(--text-primary)',
              }}
              aria-label={`MFA digit ${idx + 1}`}
              autoFocus={idx === 0}
            />
          ))}
        </div>

        {mfaError && (
          <div
            className="bantai-auth-card__form-error"
            role="alert"
            aria-live="polite"
          >
            {mfaError}
          </div>
        )}

        {resendNotice && !mfaError && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              fontSize: '0.85rem',
              color: 'var(--status-safe, #16a34a)',
              marginBottom: 12,
            }}
            role="status"
          >
            {resendNotice}
          </div>
        )}

        <div className="bantai-auth-card__actions" style={{ marginTop: 16 }}>
          <button
            type="submit"
            className="bantai-auth-card__primary"
            disabled={loading || otp.join('').length < 6}
            aria-disabled={loading || otp.join('').length < 6}
          >
            {loading ? 'Verifying MFA…' : 'Verify & Enter Admin Portal'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            fontSize: '0.85rem',
          }}
        >
          <button
            type="button"
            onClick={() => void handleResendMfa()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Resend MFA code
          </button>
          <button
            type="button"
            onClick={handleBackToCredentials}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Cancel sign-in
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="bantai-auth-card__form"
      onSubmit={(e) => void handleCredentialsSubmit(e)}
      noValidate
    >
      <Input
        label="Staff work email"
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        placeholder="staff@internal.bantai.dev"
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
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setPasswordError(undefined);
          setFormError(undefined);
        }}
        error={passwordError}
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
          {loading ? 'Authenticating…' : 'Continue to Staff MFA →'}
        </button>
      </div>

      <p
        className="bantai-auth-card__foot"
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        Protected staff surface. Unauthorized access attempts are monitored and
        logged.
      </p>
    </form>
  );
};
