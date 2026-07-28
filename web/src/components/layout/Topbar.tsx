import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { ProfileDropdown } from '../navigation/ProfileDropdown';
import { useUserAvatar } from '../../context/UserAvatarContext';
import { UserAvatar } from '../common/UserAvatar';

interface TopbarProps {
  role: 'client' | 'admin';
  title: string;
  tag: string;
  userInitials: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: 'red' | 'amber' | 'blue' | 'green';
  read: boolean;
  route: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: '🚨 Critical Campaign Outbreak',
    body: 'Operation GCash Clone #17 spiked +380% in last hour.',
    time: '2m ago',
    tone: 'red',
    read: false,
    route: '/client/campaigns',
  },
  {
    id: 'n2',
    title: '⚠️ Concept Drift Alert',
    body: 'False negative rate increased 1.4% over 7 days.',
    time: '38m ago',
    tone: 'amber',
    read: false,
    route: '/admin/model',
  },
  {
    id: 'n3',
    title: '📄 Daily Report Ready',
    body: '312 user reports classified today - 23 confirmed smishing.',
    time: '2h ago',
    tone: 'blue',
    read: false,
    route: '/client/export',
  },
  {
    id: 'n4',
    title: '🖥️ High API Latency Peak',
    body: 'Peak latency reached 312ms at 12:00 PST.',
    time: '4h ago',
    tone: 'amber',
    read: true,
    route: '/admin/api-logs',
  },
];

export const Topbar: React.FC<TopbarProps> = ({ role, title, tag, userInitials }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminAvatar, clientAvatar } = useUserAvatar();
  const currentAvatar = role === 'admin' ? adminAvatar : clientAvatar;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notif: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setShowNotifications(false);
    navigate(notif.route);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');

  return (
    <header className="dashboard-topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {breadcrumbs || 'Dashboard'}
        </div>
        <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{title}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Live Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search threats, IP, domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ height: 36, fontSize: '0.8125rem', paddingLeft: 32 }}
          />
          <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            🔍
          </span>
        </div>

        {/* Notifications Button */}
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          style={{
            position: 'relative',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.625rem',
                fontWeight: 800,
                width: 16,
                height: 16,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Tag Pill */}
        <span className={`badge ${role === 'admin' ? 'badge-amber' : 'badge-purple'}`} style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
          {tag}
        </span>

        {/* Profile Avatar */}
        <div style={{ cursor: 'pointer' }} onClick={() => setShowProfileMenu(!showProfileMenu)}>
          <UserAvatar avatar={currentAvatar} role={role} size={36} fallbackInitials={userInitials} />
        </div>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <ProfileDropdown role={role} onClose={() => setShowProfileMenu(false)} />
        )}

        {/* Interactive Notification Panel */}
        {showNotifications && (
          <div
            className="animate-scale-in"
            style={{
              position: 'absolute',
              top: 60,
              right: 40,
              width: 360,
              background: '#14141e',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
              zIndex: 90,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Notification Center</strong>
                {unreadCount > 0 && <span className="badge badge-purple">{unreadCount} new</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-light)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8125rem', maxHeight: 320, overflowY: 'auto' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: n.read ? 'rgba(255,255,255,0.02)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${n.read ? 'var(--border-subtle)' : 'var(--border-active)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                  className="panel-hover"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <strong style={{ color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '0.875rem' }}>
                      {n.title}
                    </strong>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>{n.time}</small>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0 }}>
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
