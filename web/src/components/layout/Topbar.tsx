import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { ProfileDropdown } from '../navigation/ProfileDropdown';
import { useUserAvatar } from '../../context/UserAvatarContext';
import { UserAvatar } from '../common/UserAvatar';
import { getCurrentUser, type CurrentUser } from '../../services/authService';

interface TopbarProps {
  role: 'client' | 'admin';
  title: string;
  tag: string;
  userInitials: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  role,
  title,
  tag,
  userInitials,
}) => {
  const location = useLocation();
  const { adminAvatar, clientAvatar } = useUserAvatar();
  const currentAvatar = role === 'admin' ? adminAvatar : clientAvatar;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTagTooltip, setShowTagTooltip] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  React.useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  const derivedInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.phone.slice(-2)
    : userInitials;

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');

  return (
    <header className="dashboard-topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {breadcrumbs || 'Dashboard'}
        </div>
        <strong
          style={{
            fontSize: '2.125rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {title}
        </strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Notifications Button */}
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label="Open notifications"
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
          <Bell size={18} />
        </button>

        {/* Tag Pill with Hover Description Tooltip */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowTagTooltip(true)}
          onMouseLeave={() => setShowTagTooltip(false)}
        >
          <span
            className={`badge ${role === 'admin' ? 'badge-amber' : 'badge-purple'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow:
                role === 'admin'
                  ? '0 0 10px rgba(245, 158, 11, 0.2)'
                  : '0 0 10px rgba(124, 58, 237, 0.2)',
            }}
          >
            <span>{role === 'admin' ? '' : ''}</span>
            <span>{tag}</span>
          </span>

          {showTagTooltip && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute',
                top: '125%',
                right: 0,
                width: 290,
                background: '#12121a',
                border: '1px solid var(--border-default)',
                boxShadow:
                  '0 12px 32px rgba(0,0,0,0.7), 0 0 16px rgba(245, 158, 11, 0.25)',
                borderRadius: 10,
                padding: '12px 14px',
                zIndex: 100,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 6,
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>
                  {role === 'admin' ? '' : ''}
                </span>
                <strong
                  style={{
                    fontSize: '0.875rem',
                    color:
                      role === 'admin'
                        ? 'var(--amber-text)'
                        : 'var(--accent-light)',
                  }}
                >
                  {role === 'admin'
                    ? 'Super Administrator Privileges'
                    : 'Client Intelligence Portal'}
                </strong>
              </div>
              <p
                style={{
                  fontSize: '0.78125rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                {role === 'admin'
                  ? 'Administrator role confirmed by the authenticated /auth/me response.'
                  : 'Client role confirmed by the authenticated /auth/me response.'}
              </p>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <UserAvatar
            avatar={currentAvatar}
            role={role}
            size={36}
            fallbackInitials={derivedInitials}
          />
        </div>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <ProfileDropdown
            role={role}
            onClose={() => setShowProfileMenu(false)}
          />
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Notification Center</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowNotifications(false)}
                  aria-label="Close notifications"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.8125rem',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Notifications are unavailable because the backend does not yet
                expose an authenticated notification endpoint.
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
