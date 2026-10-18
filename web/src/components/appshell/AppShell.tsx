import React from 'react';
import { createPortal } from 'react-dom';
import { MenuIcon, CloseIcon } from '../primitives/icons';
import { HelpPopover } from '../primitives/HelpPopover';
import {
  AccountMenu,
  type AccountMenuLink,
  type AccountMenuUser,
} from './AccountMenu';
import { NotificationBell, unreadBadgeText } from './NotificationBell';
import { HubContext } from './hubContext';
import './appshell.css';

export type Role = 'client' | 'admin';

export interface NavItemDef {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: Role[];
  permissions?: string[];
  /** Items waiting on the person (e.g. pending reviews). Hidden at 0. */
  badge?: number;
}

export interface NavGroupDef {
  /** Omitted for the first group: a heading there only repeats its items. */
  label?: string;
  /** 'bottom' pins the group to the foot of the sidebar (reference links). */
  placement?: 'bottom';
  roles?: Role[];
  items: NavItemDef[];
}

interface AppShellProps {
  role: Role;
  groups: NavGroupDef[];
  brandInitial?: string;
  brandLabel?: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  topbarContext?: React.ReactNode;
  topbarUtility?: React.ReactNode;
  /** Bell in the top bar, opening this portal's notification inbox. */
  notifications?: { area: 'admin' | 'shield'; href: string };
  /** Avatar menu in the top bar. */
  account?: {
    user: AccountMenuUser | null;
    items: AccountMenuLink[];
    onSignOut: () => void;
  };
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function itemVisible(
  item: NavItemDef,
  role: Role,
  permissions: string[],
): boolean {
  if (item.roles?.length && !item.roles.includes(role)) return false;
  if (role !== 'admin' || !item.permissions?.length) return true;
  return (
    permissions.includes('*') ||
    item.permissions.some((p) => permissions.includes(p))
  );
}

function groupVisible(
  group: NavGroupDef,
  role: Role,
  permissions: string[],
): boolean {
  if (group.roles && group.roles.length > 0 && !group.roles.includes(role)) {
    return false;
  }
  return group.items.some((i) => itemVisible(i, role, permissions));
}

const COLLAPSE_KEY = 'bantai:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    // Private mode or blocked storage: the toggle still works this session.
  }
}

export function AppShell({
  role,
  groups,
  brandInitial = 'B',
  brandLabel = 'BantAI',
  currentPath,
  onNavigate,
  topbarContext,
  topbarUtility,
  notifications,
  account,
  footer,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(readCollapsed);
  // Groups arrive already filtered for the account; per-item permissions are
  // only honored for callers that still pass them (the dev shell preview).
  const permissions = ['*'];

  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const visibleGroups = groups.filter((g) =>
    groupVisible(g, role, permissions),
  );

  const renderGroup = (group: NavGroupDef, index: number) => (
    <div
      key={group.label ?? `group-${index}`}
      className="bantai-sidebar__group"
    >
      {group.label && (
        <p className="bantai-sidebar__group-label">{group.label}</p>
      )}
      {group.items
        .filter((i) => itemVisible(i, role, permissions))
        .map((item) => {
          const isActive =
            currentPath === item.path ||
            currentPath.startsWith(item.path + '/');
          const badge = unreadBadgeText(item.badge ?? 0);
          return (
            <a
              key={item.path}
              href={item.path}
              className="bantai-navitem"
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                badge ? `${item.label}, ${item.badge} pending` : undefined
              }
              title={item.label}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.path);
                closeDrawer();
              }}
            >
              <span className="bantai-navitem__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="bantai-navitem__label">{item.label}</span>
              {badge && (
                <span className="bantai-navitem__badge" aria-hidden>
                  {badge}
                </span>
              )}
            </a>
          );
        })}
    </div>
  );

  const mainGroups = visibleGroups.filter((g) => g.placement !== 'bottom');
  const bottomGroups = visibleGroups.filter((g) => g.placement === 'bottom');

  return (
    <div
      className="bantai-shell"
      data-theme="mineral"
      data-drawer={drawerOpen ? 'open' : 'closed'}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <aside className="bantai-sidebar" aria-label="Primary">
        <div className="bantai-sidebar__brand">
          <span className="bantai-sidebar__brand-mark" aria-hidden>
            {brandInitial}
          </span>
          <span>{brandLabel}</span>
        </div>
        <nav className="bantai-sidebar__nav" aria-label="Sections">
          {mainGroups.map(renderGroup)}
          {bottomGroups.length > 0 && (
            <div className="bantai-sidebar__bottom">
              {bottomGroups.map(renderGroup)}
            </div>
          )}
        </nav>
        {footer && <div className="bantai-sidebar__footer">{footer}</div>}
        <button
          type="button"
          className="bantai-sidebar__collapse"
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            setCollapsed((value) => {
              writeCollapsed(!value);
              return !value;
            });
          }}
        >
          <span aria-hidden>{collapsed ? '»' : '«'}</span>
        </button>
      </aside>

      <header className="bantai-topbar" role="banner">
        <button
          type="button"
          className="bantai-topbar__menu-btn"
          aria-label="Toggle navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          {drawerOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div className="bantai-topbar__context">{topbarContext}</div>
        <div className="bantai-topbar__utility">
          {topbarUtility}
          {notifications && (
            <NotificationBell
              area={notifications.area}
              href={notifications.href}
              active={currentPath.startsWith(notifications.href)}
              onNavigate={onNavigate}
            />
          )}
          {account && (
            <AccountMenu
              user={account.user}
              items={account.items}
              onNavigate={onNavigate}
              onSignOut={account.onSignOut}
            />
          )}
        </div>
      </header>

      <div className="bantai-shell__scrim" aria-hidden onClick={closeDrawer} />

      <main className="bantai-shell__content" id="main">
        {children}
      </main>
    </div>
  );
}

/* PageHeader: in-canvas title + description + meta strip + actions */

interface PageHeaderProps {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: PageHeaderProps) {
  const hub = React.useContext(HubContext);
  if (hub) {
    // Inside a hub the hub owns the h1. This screen's title stays for screen
    // readers; its description becomes the tab bar's "How this works" and
    // its actions sit at the tab bar's right end, so no sentence floats
    // between the tabs and the content.
    const aside =
      description || actions ? (
        <>
          {description && <HelpPopover align="end">{description}</HelpPopover>}
          {actions}
        </>
      ) : null;
    return (
      <>
        <h2 className="bantai-visually-hidden">{title}</h2>
        {meta && <p className="bantai-pageheader__meta">{meta}</p>}
        {aside && hub.slot && createPortal(aside, hub.slot)}
      </>
    );
  }
  return (
    <header className="bantai-pageheader">
      <div className="bantai-pageheader__row">
        <div>
          <h1 className="bantai-pageheader__title">{title}</h1>
          {description && (
            <p className="bantai-pageheader__description">{description}</p>
          )}
        </div>
        {actions && <div className="bantai-pageheader__actions">{actions}</div>}
      </div>
      {meta && <p className="bantai-pageheader__meta">{meta}</p>}
    </header>
  );
}

export default AppShell;
