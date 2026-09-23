import React from 'react';
import { MenuIcon, CloseIcon } from '../primitives/icons';
import './appshell.css';

export type Role = 'client' | 'admin';

export interface NavItemDef {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: Role[];
}

export interface NavGroupDef {
  label: string;
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
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function itemVisible(item: NavItemDef, role: Role): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

function groupVisible(group: NavGroupDef, role: Role): boolean {
  if (group.roles && group.roles.length > 0 && !group.roles.includes(role)) {
    return false;
  }
  return group.items.some((i) => itemVisible(i, role));
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
  footer,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <div
      className="bantai-shell"
      data-theme="mineral"
      data-drawer={drawerOpen ? 'open' : 'closed'}
    >
      <aside className="bantai-sidebar" aria-label="Primary">
        <div className="bantai-sidebar__brand">
          <span className="bantai-sidebar__brand-mark" aria-hidden>
            {brandInitial}
          </span>
          <span>{brandLabel}</span>
        </div>
        <nav className="bantai-sidebar__nav" aria-label="Sections">
          {groups
            .filter((g) => groupVisible(g, role))
            .map((group) => (
              <div key={group.label}>
                <p className="bantai-sidebar__group-label">{group.label}</p>
                {group.items
                  .filter((i) => itemVisible(i, role))
                  .map((item) => {
                    const isActive =
                      currentPath === item.path ||
                      currentPath.startsWith(item.path + '/');
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        className="bantai-navitem"
                        aria-current={isActive ? 'page' : undefined}
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
                        <span className="bantai-navitem__label">
                          {item.label}
                        </span>
                      </a>
                    );
                  })}
              </div>
            ))}
        </nav>
        {footer && <div className="bantai-sidebar__footer">{footer}</div>}
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
        <div className="bantai-topbar__utility">{topbarUtility}</div>
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
