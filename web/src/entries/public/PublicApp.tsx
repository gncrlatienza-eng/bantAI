import React from 'react';
import { PublicRoutes } from './PublicRoutes';
import { UserAvatarProvider } from '../../context/UserAvatarContext';

export function PublicApp() {
  return (
    <UserAvatarProvider>
      <PublicRoutes />
    </UserAvatarProvider>
  );
}

export default PublicApp;
