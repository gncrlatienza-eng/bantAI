import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { validateLoginForm } from '../../utils/validation';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface LoginFormProps {
  admin?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ admin = false }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organization: admin ? 'BantAI Research Group' : 'Globe Telecom',
    email: admin ? 'admin@bantai.research' : 'analyst@globe.com.ph',
    password: '',
    rememberMe: true,
  });

  const [errors, setErrors] = useState<{ organization?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLoginForm(formData, !admin);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate(ROUTES.TWO_FACTOR, { state: { admin, email: formData.email } });
    }, 600);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {!admin && (
        <Input
          label="Organization Name"
          placeholder="e.g. Globe Telecom"
          value={formData.organization}
          onChange={(e) => handleChange('organization', e.target.value)}
          error={errors.organization}
        />
      )}

      <Input
        label={admin ? 'Admin Email Address' : 'Work Email Address'}
        type="email"
        placeholder="name@company.com"
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
        error={errors.email}
      />

      <Input
        label="Password"
        isPassword
        placeholder="••••••••"
        value={formData.password}
        onChange={(e) => handleChange('password', e.target.value)}
        error={errors.password}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem', marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={formData.rememberMe}
            onChange={(e) => handleChange('rememberMe', e.target.checked)}
            style={{ accentColor: 'var(--accent-primary)', width: 16, height: 16 }}
          />
          <span>Remember this device</span>
        </label>
        <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Password reset link sent to your registered work email."); }} style={{ color: 'var(--accent-light)' }}>
          Forgot password?
        </a>
      </div>

      <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} style={{ marginTop: 12 }}>
        {admin ? 'Sign In as Administrator' : 'Sign In to Client Portal'}
      </Button>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        {admin ? (
          <>
            Client organization?{' '}
            <Link to={ROUTES.LOGIN} style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
              Client Portal →
            </Link>
          </>
        ) : (
          <>
            BantAI administrator?{' '}
            <Link to={ROUTES.ADMIN_LOGIN} style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
              Admin Portal →
            </Link>
          </>
        )}
      </div>
    </form>
  );
};
