/*
 * Admin Settings page — profile form in mineral shell.
 * Accepts `notifications` prop so /admin/notifications lands here too.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { ProfileForm } from '../../features/settings/ProfileForm';
import { NotificationCenter } from '../../features/notifications/NotificationCenter';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

interface SettingsPageProps {
  notifications?: boolean;
}

export function SettingsPage({ notifications = false }: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Administration &middot; {notifications ? 'Notifications' : 'Settings'}
        </span>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title={notifications ? 'Notifications' : 'Settings'}
        description={
          notifications
            ? 'Review queues, applications and contracts, API quota and AI system health, built from verified system records.'
            : 'Manage your admin profile. Your role is managed by the backend and shown read-only.'
        }
      />
      {notifications ? <NotificationCenter area="admin" /> : <ProfileForm />}
    </AppShell>
  );
}

export default SettingsPage;
