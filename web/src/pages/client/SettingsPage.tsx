/*
 * Shield → Notifications (bell and avatar menu): the inbox and which notices
 * this account gets.
 */

import React from 'react';
import { PageHeader } from '../../components/appshell/AppShell';
import { NotificationCenter } from '../../features/notifications/NotificationCenter';

export function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Notices about published campaigns, your subscription and access, and API keys."
      />
      <NotificationCenter area="shield" />
    </>
  );
}

export default NotificationsPage;
