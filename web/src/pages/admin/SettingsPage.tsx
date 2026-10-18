/*
 * Admin personal settings, reached from the avatar menu: Settings → Profile
 * and Settings → Notifications (which notices you get). The bell opens the
 * inbox itself at /admin/notifications.
 */

import React from 'react';
import { PageHeader } from '../../components/appshell/AppShell';
import { ProfileForm } from '../../features/settings/ProfileForm';
import { NotificationCenter } from '../../features/notifications/NotificationCenter';

export function ProfileSettings() {
  return <ProfileForm />;
}

export function NotificationSettings() {
  return <NotificationCenter area="admin" section="preferences" />;
}

export function NotificationsInbox() {
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationCenter area="admin" section="inbox" />
    </>
  );
}
