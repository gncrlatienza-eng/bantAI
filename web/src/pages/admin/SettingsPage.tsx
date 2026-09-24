/*
 * Admin Settings page — profile form in mineral shell.
 * Accepts `notifications` prop so /admin/notifications lands here too.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button, EmptyState, InfoBadge } from '../../components/primitives';
import { ProfileForm } from '../../features/settings/ProfileForm';
import { logout } from '../../services/authService';
import { useAdminNavGroups } from './adminNav';

interface SettingsPageProps {
  notifications?: boolean;
}

export function SettingsPage({ notifications = false }: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navGroups = useAdminNavGroups();

  return (
    <AppShell
      role="admin"
      groups={navGroups}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Administration &middot; {notifications ? 'Notifications' : 'Settings'}
        </span>
      }
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/admin-login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title={notifications ? 'Notifications' : 'Settings'}
        description={
          notifications
            ? 'Notification preferences require a backend endpoint that has not shipped yet.'
            : 'Manage your admin profile. Phone and role are managed by the backend and shown read-only.'
        }
      />
      {notifications ? (
        <EmptyState
          title="Notification preferences not connected"
          description="Delivery channel selection (email, in-app, SMS) requires an authenticated endpoint."
          action={
            <InfoBadge>Requires GET/PUT /users/me/notifications</InfoBadge>
          }
        />
      ) : (
        <ProfileForm role="admin" />
      )}
    </AppShell>
  );
}

export default SettingsPage;
