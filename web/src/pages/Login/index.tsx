import React from 'react';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { LoginForm } from '../../components/forms/LoginForm';

/*
 * LoginPage — single unified email-OTP sign-in surface for the web portal.
 *
 * There is no admin/client toggle and no admin-only URL. Only three kinds of
 * accounts can sign in here — administrators and Shield portal members. The card's heading lives in LoginForm so it
 * can switch from "Welcome back" to "Check your email" at the OTP step.
 */
export const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <div className="bantai-auth-card">
        <LoginForm />
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
