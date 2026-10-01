/*
 * Client Settings page — profile form in mineral shell.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button } from '../../components/primitives';
import { ProfileForm } from '../../features/settings/ProfileForm';
import { NotificationCenter } from '../../features/notifications/NotificationCenter';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';

interface SettingsPageProps {
  notifications?: boolean;
}

export function SettingsPage({ notifications = false }: SettingsPageProps) {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Shield &middot; {notifications ? 'Notifications' : 'Account settings'}
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
        <span style={{ fontSize: '0.85rem' }}>
          Shield intelligence subscription
        </span>
      }
    >
      <PageHeader
        title={notifications ? 'Notifications' : 'Account settings'}
        description={
          notifications
            ? 'Your notices about published campaigns, your subscription and access, and API keys and usage.'
            : 'Manage your Shield account profile. Account, subscription, billing, and security actions remain server-controlled.'
        }
      />
      {notifications ? <NotificationCenter area="shield" /> : <ProfileForm />}
    </AppShell>
  );
}

export default SettingsPage;
