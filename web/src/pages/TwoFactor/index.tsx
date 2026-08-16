import React from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldLogo } from '../../components/common/ShieldLogo';
import { TwoFactorForm } from '../../components/forms/TwoFactorForm';

interface TwoFactorLocationState {
  admin?: boolean;
  email?: string;
}

export const TwoFactorPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as TwoFactorLocationState | null;
  const admin = Boolean(state?.admin);
  const email = state?.email;

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
        <ShieldLogo size={48} style={{ marginBottom: 16 }} />
        <h1>Two-Factor Authentication</h1>
        <TwoFactorForm admin={admin} email={email} />
      </div>
    </div>
  );
};
