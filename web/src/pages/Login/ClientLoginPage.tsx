import React from 'react';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { ClientLoginForm } from '../../components/forms/ClientLoginForm';

export const ClientLoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <div className="bantai-auth-card">
        <p className="bantai-auth-card__eyebrow">Client Portal</p>
        <h1 className="bantai-auth-card__title">Sign in</h1>
        <p className="bantai-auth-card__subtitle">
          Sign in to access your threat intelligence dashboard.
        </p>
        <ClientLoginForm />
      </div>
    </AuthLayout>
  );
};

export default ClientLoginPage;
