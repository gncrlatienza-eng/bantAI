import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldLogo } from '../../components/common/ShieldLogo';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { ROUTES } from '../../constants/routes';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Work email address is required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid work email address.');
      return;
    }

    setError(null);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 900);
  };

  return (
    <div className="auth-shell">
      <Link
        to={ROUTES.HOME}
        style={{
          position: 'absolute',
          top: 28,
          left: 32,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 18px',
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: 'var(--text-secondary)',
          fontSize: '0.8125rem',
          fontWeight: 700,
          textDecoration: 'none',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          transition: 'all 0.2s ease',
        }}
      >
        ← Return to Home Page
      </Link>

      <div className="auth-card" style={{ maxWidth: 460 }}>
        <ShieldLogo size={48} style={{ marginBottom: 16 }} />
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: 6,
          }}
        >
          Reset Password
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Enter your registered work email address to receive password reset
          instructions.
        </p>

        {submitted ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 14,
                padding: '20px 22px',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <span
                style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}
              >
                🔑
              </span>
              <strong
                style={{
                  color: '#34d399',
                  fontSize: '1rem',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Reset Link Dispatched!
              </strong>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                We sent a 1-time password recovery link to{' '}
                <strong
                  style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}
                >
                  {email}
                </strong>
                . Please check your inbox.
              </p>
            </div>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setSubmitted(false)}
              style={{ borderRadius: 10, padding: '10px 0' }}
            >
              🔄 Resend Reset Email
            </Button>

            <Link
              to={ROUTES.LOGIN}
              style={{
                color: '#60a5fa',
                fontSize: '0.84375rem',
                fontWeight: 700,
                textDecoration: 'none',
                marginTop: 6,
              }}
            >
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <Input
              label="Work Email Address"
              type="email"
              placeholder="analyst@organization.com.ph"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              error={error || undefined}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              style={{ marginTop: 8 }}
            >
              Send Recovery Link →
            </Button>

            <div
              style={{
                textAlign: 'center',
                marginTop: 12,
                fontSize: '0.8125rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <Link
                to={ROUTES.LOGIN}
                style={{
                  color: 'var(--accent-light)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                ← Return to Sign In
              </Link>
              <Link
                to={ROUTES.HOME}
                style={{
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: '0.8125rem',
                }}
              >
                ← Return to Home Page
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
