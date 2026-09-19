import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { requestOtp } from '../../services/authService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface LoginFormProps {
  admin?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ admin = false }) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Enter your Philippine mobile number.');
      return;
    }

    setLoading(true);
    try {
      await requestOtp(phone.trim());
      void navigate(ROUTES.TWO_FACTOR, {
        state: { admin, phone: phone.trim() },
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not send a verification code.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <Input
        label="Philippine mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="e.g. +639171234567"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setError(undefined);
        }}
        error={error}
        helpText="We send a one-time code to verify access."
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        style={{ marginTop: 12 }}
      >
        {admin ? 'Send administrator code' : 'Send access code'}
      </Button>

      <div
        style={{
          textAlign: 'center',
          marginTop: 16,
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        {admin ? (
          <>
            Client organization?{' '}
            <Link
              to={ROUTES.LOGIN}
              style={{ color: 'var(--accent-light)', fontWeight: 600 }}
            >
              Client Portal →
            </Link>
          </>
        ) : (
          <>
            BantAI administrator?{' '}
            <Link
              to={ROUTES.ADMIN_LOGIN}
              style={{ color: 'var(--accent-light)', fontWeight: 600 }}
            >
              Admin Portal →
            </Link>
          </>
        )}
      </div>
    </form>
  );
};
