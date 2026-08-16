import React, { useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { ShieldLogo } from '../common/ShieldLogo';
import { useUserAvatar } from '../../context/UserAvatarContext';
import { UserAvatar } from '../common/UserAvatar';

// Module-level in-memory cache for fast scroll position restoration across component unmount/remount
const sidebarScrollPositions: Record<string, number> = {};

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  role: 'client' | 'admin';
  groups: NavGroup[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  userInitials: string;
  userName: string;
  userMeta: string;
  org: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  groups,
  collapsed,
  onToggleCollapse,
  userInitials,
  userName,
  userMeta,
  org,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminAvatar, clientAvatar } = useUserAvatar();
  const currentAvatar = role === 'admin' ? adminAvatar : clientAvatar;
  const navRef = useRef<HTMLElement>(null);

  const scrollKey = `sidebar_scroll_${role}`;

  // Restore scroll position before browser repaint
  useLayoutEffect(() => {
    let savedPos = sidebarScrollPositions[scrollKey];
    if (savedPos === undefined) {
      const stored = sessionStorage.getItem(scrollKey);
      if (stored !== null) {
        savedPos = parseInt(stored, 10);
      }
    }

    if (navRef.current) {
      if (savedPos !== undefined && !isNaN(savedPos)) {
        navRef.current.scrollTop = savedPos;
      } else {
        // Fallback: scroll active item into view if no saved position exists
        const activeLink = navRef.current.querySelector('.sidebar-link.active') as HTMLElement | null;
        if (activeLink) {
          activeLink.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [location.pathname, role, scrollKey]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    sidebarScrollPositions[scrollKey] = target.scrollTop;
    sessionStorage.setItem(scrollKey, String(target.scrollTop));
  };

  const saveScrollPos = () => {
    if (navRef.current) {
      sidebarScrollPositions[scrollKey] = navRef.current.scrollTop;
      sessionStorage.setItem(scrollKey, String(navRef.current.scrollTop));
    }
  };

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 76 : 260,
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Brand Header */}
      <div className="sidebar-brand" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
        <Link
          to={role === 'admin' ? ROUTES.ADMIN.OVERVIEW : ROUTES.CLIENT.OVERVIEW}
          className="brand-lockup"
          onClick={saveScrollPos}
        >
          <ShieldLogo size={32} />
          {!collapsed && (
            <div className="brand-text">
              <strong>BantAI</strong>
              <small>{role === 'admin' ? 'System Administration' : 'Client Intelligence Portal'}</small>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Nav Section Links */}
      <nav ref={navRef} className="sidebar-nav" onScroll={handleScroll}>
        {groups.map((group, gIdx) => (
          <div key={group.title || gIdx} className="sidebar-section">
            {group.title && !collapsed && <span className="sidebar-title">{group.title}</span>}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={saveScrollPos}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '12px' : '10px 12px',
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <span style={{ fontSize: '1.125rem' }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer User Card */}
      <div
        className="sidebar-foot"
        onClick={() => {
          saveScrollPos();
          navigate(role === 'admin' ? ROUTES.ADMIN.SETTINGS : ROUTES.CLIENT.SETTINGS);
        }}
        style={{
          cursor: 'pointer',
          borderRadius: 8,
          padding: '10px 12px',
          transition: 'background 0.2s ease',
        }}
        title="View Profile & Contact Settings"
      >
        {!collapsed && (
          <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}>
            {org}
          </small>
        )}
        <div className="account-row" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <UserAvatar avatar={currentAvatar} role={role} size={36} fallbackInitials={userInitials} />
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                {userName}
              </strong>
              <small style={{ display: 'block', color: 'var(--accent-light)', fontSize: '0.6875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userMeta}
              </small>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
