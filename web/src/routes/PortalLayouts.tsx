/*
 * Signed-in layouts. Each portal mounts its AppShell once and renders the
 * current screen into <Outlet />, so the sidebar and top bar stay put while
 * screens change (they used to remount, and re-fetch the account, on every
 * navigation). The sidebar, breadcrumb and landing all come from the
 * navigation registry (src/navigation/portalNav.tsx).
 */

import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/appshell/AppShell';
import { Breadcrumb } from '../components/appshell/Breadcrumb';
import { HubPage } from '../components/appshell/HubPage';
import { LoadingState } from '../components/primitives/LoadingState';
import { useAccountState } from '../context/AccountStateContext';
import {
  ADMIN_NAV,
  ADMIN_UTILITY,
  SHIELD_NAV,
  SHIELD_UTILITY,
  adminPathPermitted,
  breadcrumbFor,
  firstPermittedAdminPath,
  hasPermission,
  toNavGroups,
  type PortalSection,
} from '../navigation/portalNav';
import {
  getCurrentUser,
  logout,
  type CurrentUser,
} from '../services/authService';
import { getPendingReports } from '../services/reportsService';
import { getPendingSenderReports } from '../services/senderReportsService';
import { getAccessRequests } from '../services/accessRequestsService';

/* ------------------------------------------------------------------ */
/*  Admin                                                             */
/* ------------------------------------------------------------------ */

/*
 * The last answer from /auth/me, kept for the session so a remount (or a
 * failed refresh) never drops the sidebar back to an empty account. Dropped
 * on sign-out.
 */
let lastKnownUser: CurrentUser | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('bantai:signed-out', () => {
    lastKnownUser = null;
  });
}

interface AdminAccess {
  user: CurrentUser | null;
  /** null until /auth/me answers. */
  permissions: string[] | null;
}

const AdminAccessContext = React.createContext<AdminAccess>({
  user: null,
  permissions: null,
});

export function useAdminAccess(): AdminAccess {
  return React.useContext(AdminAccessContext);
}

function useAdminUser(): CurrentUser | null {
  const [user, setUser] = React.useState<CurrentUser | null>(lastKnownUser);
  React.useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then((current) => {
        lastKnownUser = current;
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // Keep the last known account; a failed refresh is not a sign-out.
        if (!cancelled) setUser(lastKnownUser);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

const WAITING_ON_ADMIN = new Set(['RECEIVED', 'UNDER_REVIEW']);

/*
 * Sidebar counts: reports and sender reports waiting for review, and Shield
 * applications waiting for a decision. Refreshed when the person moves to a
 * different section, so clearing a queue shows on the way out.
 */
function useAdminBadges(
  permissions: string[] | null,
  pathname: string,
): Partial<Record<string, number>> {
  const [badges, setBadges] = React.useState<Partial<Record<string, number>>>(
    {},
  );
  const section = pathname.split('/')[2] ?? '';
  const key = permissions?.join(',') ?? null;
  React.useEffect(() => {
    if (key === null) return;
    const granted = key ? key.split(',') : [];
    let cancelled = false;
    const count = <T,>(load: () => Promise<T[]>, keep?: (row: T) => boolean) =>
      load()
        .then((rows) => (keep ? rows.filter(keep) : rows).length)
        .catch(() => 0);
    const review = Promise.all([
      hasPermission(granted, ['reports:read']) ? count(getPendingReports) : 0,
      hasPermission(granted, ['verification:read'])
        ? count(getPendingSenderReports)
        : 0,
    ]).then(([reports, senders]) => reports + senders);
    const customers = hasPermission(granted, ['access_requests:manage'])
      ? count(
          () => getAccessRequests(),
          (row) => WAITING_ON_ADMIN.has(row.status),
        )
      : Promise.resolve(0);
    void Promise.all([review, customers]).then(([r, c]) => {
      if (!cancelled) setBadges({ review: r, customers: c });
    });
    return () => {
      cancelled = true;
    };
  }, [key, section]);
  return badges;
}

function ScreenFallback() {
  return <LoadingState label="Loading page" />;
}

export function AdminLayout() {
  const user = useAdminUser();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = user ? (user.permissions ?? []) : null;
  const badges = useAdminBadges(permissions, location.pathname);

  // Land on the first screen this account can use, and never leave someone
  // on a screen whose data their staff role cannot read.
  if (permissions && !adminPathPermitted(location.pathname, permissions)) {
    return <Navigate to={firstPermittedAdminPath(permissions)} replace />;
  }

  const onNavigate = (path: string) => void navigate(path);
  return (
    <AdminAccessContext.Provider value={{ user, permissions }}>
      <AppShell
        role="admin"
        // Until the account is known, show the whole menu rather than hiding
        // gated items. Navigation is only a usability gate.
        groups={toNavGroups(ADMIN_NAV, permissions ?? ['*'], badges)}
        brandInitial="B"
        brandLabel="BantAI Admin"
        currentPath={location.pathname}
        onNavigate={onNavigate}
        topbarContext={
          <Breadcrumb
            parts={breadcrumbFor(ADMIN_NAV, ADMIN_UTILITY, location.pathname)}
            onNavigate={onNavigate}
          />
        }
        notifications={{ area: 'admin', href: '/admin/notifications' }}
        account={{
          user,
          // Notification preferences are a tab inside Settings, and the bell
          // opens the inbox, so Settings is the only link needed here.
          items: [{ label: 'Settings', path: '/admin/settings/profile' }],
          onSignOut: () => {
            logout();
            onNavigate('/login');
          },
        }}
      >
        <React.Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </React.Suspense>
      </AppShell>
    </AdminAccessContext.Provider>
  );
}

/** `/admin`: the first screen this account can use. */
export function AdminLanding() {
  const { permissions } = useAdminAccess();
  if (!permissions) return <ScreenFallback />;
  return <Navigate to={firstPermittedAdminPath(permissions)} replace />;
}

function findAdminSection(id: string): PortalSection {
  const section = [
    ...ADMIN_NAV.flatMap((g) => g.sections),
    ...ADMIN_UTILITY,
  ].find((s) => s.id === id);
  if (!section) throw new Error(`Unknown admin section: ${id}`);
  return section;
}

/** A hub screen (Review, Model, Customers, System, Settings). */
export function AdminHub({
  id,
  description,
  notice,
  legacyTabs,
}: {
  id: string;
  description?: string;
  notice?: React.ReactNode;
  legacyTabs?: Record<string, string>;
}) {
  const { permissions } = useAdminAccess();
  if (!permissions) return <ScreenFallback />;
  return (
    <HubPage
      section={findAdminSection(id)}
      permissions={permissions}
      description={description}
      notice={notice}
      legacyTabs={legacyTabs}
    />
  );
}

/*
 * Settings is where an admin account without a staff role lands (it can
 * open nothing else), so say why the sidebar is empty.
 */
export function AdminSettingsHub() {
  const { permissions } = useAdminAccess();
  const noAccess = permissions !== null && permissions.length === 0;
  return (
    <AdminHub
      id="settings"
      notice={
        noAccess ? (
          <p className="bantai-hubnotice" role="status">
            This account has no staff role yet, so no admin workspace is
            available. Ask a superadmin to assign one.
          </p>
        ) : undefined
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Shield                                                            */
/* ------------------------------------------------------------------ */

const SHIELD_GROUPS = toNavGroups(SHIELD_NAV, ['*']);

export function ShieldLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useAccountState();
  const onNavigate = (path: string) => void navigate(path);
  return (
    <AppShell
      role="client"
      groups={SHIELD_GROUPS}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={onNavigate}
      topbarContext={
        <Breadcrumb
          parts={breadcrumbFor(SHIELD_NAV, SHIELD_UTILITY, location.pathname)}
          onNavigate={onNavigate}
        />
      }
      notifications={{ area: 'shield', href: '/shield/notifications' }}
      account={{
        user: state?.account ?? null,
        // The bell already opens Notifications (inbox and preferences).
        items: [{ label: 'Account', path: '/shield/account' }],
        onSignOut: () => {
          logout();
          onNavigate('/login');
        },
      }}
    >
      <React.Suspense fallback={<ScreenFallback />}>
        <Outlet />
      </React.Suspense>
    </AppShell>
  );
}
