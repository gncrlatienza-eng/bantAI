import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientLogin } from '../../services/authService';
import { Input } from '../common/Input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_AUTH_FAILURE =
  'Those credentials did not work. Check your email and password and try again.';

export const ClientLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);

    const trimmedEmail = email.trim();
    let hasError = false;

    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError('Enter a valid work email.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Enter your password.');
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      await clientLogin(trimmedEmail, password);
      void navigate('/client/overview');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : GENERIC_AUTH_FAILURE;
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="bantai-auth-card__form"
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
    >
      <Input
        label="Work email"
        type="email"
        name="email"
        autoComplete="username"
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
          {loading ? 'Signing in…' : 'Sign in to Client Portal'}
        </button>
      </div>

      <p className="bantai-auth-card__foot">
        Need access? <Link to="/request-access">Request access →</Link>
      </p>
    </form>
  );
};
