import React, { useRef, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { ShieldLogo } from '../common/ShieldLogo';

// Module-level in-memory cache for fast scroll position restoration across component unmount/remount
const sidebarScrollPositions: Record<string, number> = {};

interface NavItem {
  path: string;
  label: string;
  icon?: string;
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
  userInitials?: string;
  userName?: string;
  userMeta?: string;
  org?: string;
}

function getShortCode(label: string): string {
  if (!label) return '';
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  groups,
  collapsed,
  onToggleCollapse,
}) => {
  const location = useLocation();
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
        const activeLink = navRef.current.querySelector('.sidebar-link.active');
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
      <div
        className="sidebar-brand"
        style={{ justifyContent: collapsed ? 'center' : 'space-between' }}
      >
        <Link
          to={role === 'admin' ? ROUTES.ADMIN.OVERVIEW : ROUTES.CLIENT.OVERVIEW}
          className="brand-lockup"
          onClick={saveScrollPos}
        >
          <ShieldLogo size={32} />
          {!collapsed && (
            <div className="brand-text">
              <strong>BantAI</strong>
              <small>
                {role === 'admin'
                  ? 'System Administration'
                  : 'Client Intelligence Portal'}
              </small>
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
            {group.title && !collapsed && (
              <span className="sidebar-title">{group.title}</span>
            )}
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
                    padding: collapsed ? '10px 12px' : '8px 12px 8px 24px',
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '0.05em',
                        color: isActive ? '#a78bfa' : 'var(--text-secondary)',
                      }}
                    >
                      {getShortCode(item.label)}
                    </span>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
