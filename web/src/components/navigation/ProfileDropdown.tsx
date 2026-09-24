import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useUserAvatar } from '../../context/UserAvatarContext';
import { UserAvatar } from '../common/UserAvatar';
import {
  getCurrentUser,
  getCustomerMetadata,
  logout,
  type CurrentUser,
} from '../../services/authService';

interface ProfileDropdownProps {
  onClose: () => void;
  role: 'client' | 'admin';
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  onClose,
  role,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useClickOutside<HTMLDivElement>(onClose);
  const { adminAvatar, clientAvatar } = useUserAvatar();
  const currentAvatar = role === 'admin' ? adminAvatar : clientAvatar;
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  React.useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleNavigate = (path: string) => {
    onClose();
    void navigate(path);
  };

  const isClient = role === 'client';
  const customerMeta = getCustomerMetadata(user);

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone
    : 'Loading account…';
  const userTitle = isClient
    ? `${customerMeta.membership} · ${customerMeta.workspace}`
    : 'System administrator';
  const userOrg = isClient
    ? customerMeta.workspace
    : user?.email || user?.phone || 'Staff Account';
  const userEmail = user?.email || user?.phone || 'current account';
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.phone.slice(-2)
    : '—';

  const settingsRoute = isClient
    ? ROUTES.CLIENT.SETTINGS
    : ROUTES.ADMIN.SETTINGS;

  return (
    <div
      className="profile-dropdown animate-scale-in"
      ref={dropdownRef}
      style={{ width: 260, padding: 12 }}
    >
      {/* User Account Header */}
      <div
        onClick={() => handleNavigate(settingsRoute)}
        style={{
          padding: '8px 10px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 8,
          cursor: 'pointer',
          borderRadius: 8,
          transition: 'background 0.2s ease',
        }}
        className="dropdown-item-header"
        title="View Profile & Workspace Settings"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <UserAvatar
            avatar={currentAvatar}
            role={role}
            size={36}
            fallbackInitials={initials}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              style={{
                display: 'block',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--text-primary)',
              }}
            >
              {userName}
            </strong>
            <small
              style={{
                display: 'block',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userTitle}
            </small>
          </div>
        </div>
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-dim)',
            background: 'var(--bg-surface-elevated)',
            padding: '4px 8px',
            borderRadius: 4,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{userOrg}</span>
          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
            {isClient
              ? `${customerMeta.license.toUpperCase()} LICENSE`
              : 'STAFF'}
          </span>
        </div>
      </div>

      {/* Account Settings */}
      <button
        type="button"
        className="dropdown-item"
        onClick={() => handleNavigate(settingsRoute)}
      >
        <span style={{ fontSize: '1rem' }}></span>
        <span>Account Settings</span>
      </button>

      <div
        style={{
          height: 1,
          background: 'var(--border-subtle)',
          margin: '4px 0',
        }}
      />

      {/* Sign Out */}
      <button
        type="button"
        className="dropdown-item danger"
        onClick={() => {
          logout();
          handleNavigate(role === 'admin' ? ROUTES.ADMIN_LOGIN : ROUTES.LOGIN);
        }}
      >
        <span style={{ fontSize: '1rem' }}></span>
        <span>Sign Out ({userEmail})</span>
      </button>
    </div>
  );
};
