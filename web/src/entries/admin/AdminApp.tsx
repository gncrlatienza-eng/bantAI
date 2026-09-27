import React from 'react';
import { AdminRoutes } from './AdminRoutes';
import { UserAvatarProvider } from '../../context/UserAvatarContext';

export function AdminApp() {
  return (
    <UserAvatarProvider>
      <AdminRoutes />
    </UserAvatarProvider>
  );
}

export default AdminApp;
