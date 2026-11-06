import React from 'react';
import { useLocation } from 'react-router-dom';
import { AuthShell } from '../../components/appshell/AuthShell';
import { TwoFactorForm } from '../../components/forms/TwoFactorForm';

interface TwoFactorLocationState {
  admin?: boolean;
  phone?: string;
}

export const TwoFactorPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as TwoFactorLocationState | null;
  const admin = Boolean(state?.admin);
  const phone = state?.phone;

  return (
    <AuthShell
      title="Two-factor verification"
      subtitle={
        admin
          ? 'Confirm your admin login with the code we sent.'
          : 'Confirm your sign-in with the code we sent.'
      }
    >
      <TwoFactorForm admin={admin} phone={phone} />
    </AuthShell>
  );
};

export default TwoFactorPage;
