import React from 'react';
import { ClientRoutes } from './ClientRoutes';
import { UserAvatarProvider } from '../../context/UserAvatarContext';

export function ClientApp() {
  return (
    <UserAvatarProvider>
      <ClientRoutes />
    </UserAvatarProvider>
  );
}

export default ClientApp;
