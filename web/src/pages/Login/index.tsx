import React from 'react';
import { ClientLoginPage } from './ClientLoginPage';

export { ClientLoginPage } from './ClientLoginPage';
export { AdminLoginPage } from './AdminLoginPage';

/*
 * Default export routes to ClientLoginPage for general sign-in.
 */
export const LoginPage: React.FC = () => {
  return <ClientLoginPage />;
};

export default LoginPage;
