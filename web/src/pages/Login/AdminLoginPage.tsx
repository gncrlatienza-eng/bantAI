import React from 'react';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { AdminLoginForm } from '../../components/forms/AdminLoginForm';

export const AdminLoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <div className="bantai-auth-card">
        <p className="bantai-auth-card__eyebrow">Staff Authentication</p>
        <h1 className="bantai-auth-card__title">Internal Staff Access</h1>
        <p className="bantai-auth-card__subtitle">
          Authorized personnel only. Multi-factor authentication is required.
        </p>
        <AdminLoginForm />
      </div>
    </AuthLayout>
  );
};

export default AdminLoginPage;
