import React from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldLogo } from '../../components/common/ShieldLogo';
import { TwoFactorForm } from '../../components/forms/TwoFactorForm';

export const TwoFactorPage: React.FC = () => {
  const location = useLocation();
  const admin = Boolean(location.state?.admin);
  const email = location.state?.email;

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
