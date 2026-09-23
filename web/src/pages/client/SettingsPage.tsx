/*
 * Client Settings page — profile form in mineral shell.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button, EmptyState, InfoBadge } from '../../components/primitives';
import { ProfileForm } from '../../features/settings/ProfileForm';
import { logout } from '../../services/authService';
import { CLIENT_SIDEBAR_GROUPS } from './clientNav';

interface SettingsPageProps {
  notifications?: boolean;
}

export function SettingsPage({ notifications = false }: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      role="client"
      groups={CLIENT_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Operations &middot;{' '}
          {notifications ? 'Notifications' : 'Account settings'}
        </span>
      }
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>Authenticated account</span>
      }
    >
      <PageHeader
        title={notifications ? 'Notifications' : 'Account settings'}
        description={
          notifications
            ? 'Notification preferences will live here once the backend endpoint is available.'
            : 'Manage your account profile. Phone and role are managed by the backend and shown read-only.'
        }
      />
      {notifications ? (
        <EmptyState
          title="Notification preferences not connected"
          description="Choose which alerts reach you via mobile push, email, or in-app once the backend endpoint ships."
          action={
            <InfoBadge>Requires GET/PUT /users/me/notifications</InfoBadge>
          }
        />
      ) : (
        <ProfileForm />
      )}
    </AppShell>
  );
}

export default SettingsPage;
