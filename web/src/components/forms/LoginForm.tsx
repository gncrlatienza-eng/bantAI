import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, login } from '../../services/authService';
import { Input } from '../common/Input';

/*
 * LoginForm — one calm, unified sign-in.
 *
 * There is no admin / client toggle. The visitor enters their work email and
 * password; after login, getCurrentUser() tells us the role and we route to
 * /admin/overview for ADMIN or /client/overview otherwise. The backend is the
 * only place role is decided — the surface never asks the user to declare it.
 *
 * The form is a single step. An email-first step was previously used but did
 * not branch to any real authentication decision (no SSO discovery, no
 * passkey routing), so it added a click without value and broke password
 * managers that expect email and password on the same page. We collapsed it.
 *
 * Access is licensed, so this form does not offer account creation. A quiet
 * "Request access →" link points to the public request-access page.
 *
 * Authentication failures return a single generic message. We do not tell the
 * caller whether the email exists.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_AUTH_FAILURE =
  'Those credentials did not work. Check your email and password and try again.';

export const LoginForm: React.FC = () => {
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
      await login(trimmedEmail, password);
      const me = await getCurrentUser();
      void navigate(me.role === 'ADMIN' ? '/admin/overview' : '/client/overview');
    } catch {
      // Never surface whether the account exists or which field was wrong.
      setFormError(GENERIC_AUTH_FAILURE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="bantai-auth-card__form"
      onSubmit={handleSubmit}
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <p className="bantai-auth-card__foot">
        Need access? <Link to="/request-access">Request access →</Link>
      </p>
    </form>
  );
};
