import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldLogo } from '../../components/common/ShieldLogo';
import { LoginForm } from '../../components/forms/LoginForm';
import { ROUTES } from '../../constants/routes';

export const AdminLoginPage: React.FC = () => {
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
