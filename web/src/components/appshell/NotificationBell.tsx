/*
 * Top-bar notification bell, beside the account avatar (the common header
 * pattern: bell top-right, unread count on the icon, hidden at zero, capped
 * at 99+). It opens the Notifications inbox; preferences live in Settings.
 */

import React from 'react';
import { NotificationsIcon } from '../primitives/icons';
import { getNotificationInbox } from '../../services/portalNotificationsService';

interface NotificationBellProps {
  area: 'admin' | 'shield';
  href: string;
  active: boolean;
  onNavigate: (path: string) => void;
}

export function unreadBadgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export function NotificationBell({
  area,
  href,
  active,
  onNavigate,
}: NotificationBellProps) {
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getNotificationInbox(area)
        .then((inbox) => {
          if (!cancelled) setUnread(inbox.unreadCount);
        })
        // No inbox access (or the request failed): show the bell, no badge.
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener('bantai:notifications-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('bantai:notifications-changed', refresh);
    };
  }, [area]);

  const badge = unreadBadgeText(unread);
  const label = badge ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <a
      href={href}
      className="bantai-bell"
      aria-label={label}
      title="Notifications"
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      <NotificationsIcon aria-hidden />
      {badge && (
        <span className="bantai-bell__badge" aria-hidden>
          {badge}
        </span>
      )}
    </a>
  );
}
