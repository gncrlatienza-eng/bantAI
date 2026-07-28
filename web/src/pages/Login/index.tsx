import React from 'react';
import { LoginForm } from '../../components/forms/LoginForm';

import { ShieldLogo } from '../../components/common/ShieldLogo';

export const LoginPage: React.FC = () => {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <ShieldLogo size={48} style={{ marginBottom: 16 }} />
        <h1>BantAI</h1>
        <p>Client Intelligence Portal</p>
        <LoginForm admin={false} />
      </div>
    </div>
  );
};
