import React from 'react';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { LoginForm } from '../../components/forms/LoginForm';

/*
 * LoginPage — single unified sign-in surface. No admin/client toggle,
 * no account creation. The backend determines the destination after
 * authentication.
 */
export const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <div className="bantai-auth-card">
        <p className="bantai-auth-card__eyebrow">Sign in</p>
        <h1 className="bantai-auth-card__title">Welcome back</h1>
        <p className="bantai-auth-card__subtitle">
          Sign in to continue to BantAI.
        </p>
        <LoginForm />
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
