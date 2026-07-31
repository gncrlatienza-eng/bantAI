import React from 'react';
import { ShieldLogo } from '../../components/common/ShieldLogo';
import { LoginForm } from '../../components/forms/LoginForm';

export const AdminLoginPage: React.FC = () => {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <ShieldLogo size={48} style={{ marginBottom: 16 }} />
        <h1>BantAI Admin</h1>
        <p>System Administration Portal</p>
        <div className="warning-strip">
          <span>⚠️ Super Admin Access — Authorized Personnel Only</span>
        </div>
        <LoginForm admin={true} />
      </div>
    </div>
  );
};
