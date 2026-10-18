import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { LoadingState } from '../components/primitives/LoadingState';
import { LandingPage, RequestAccessPage } from '../pages/public';
import { SignUpPage } from '../pages/account/SignUpPage';
import { LoginPage } from '../pages/Login';
import type { RouteGroup } from '../services/accountService';
import { LifecycleRoute, SetupGate, SignedOutOnly } from './LifecycleRoute';

/*
 * Signed-in pages load as separate chunks: a visitor to the landing or
 * sign-in page no longer downloads every admin and Shield screen (the single
 * bundle was ~615 kB). Public pages stay in the main bundle for first paint.
 * Every lazy page is rendered through lifecycle(), which supplies the
 * Suspense boundary.
 */
function lazyPage<M>(
  load: () => Promise<M>,
  pick: (module: M) => React.ComponentType<any>,
) {
  return React.lazy(() => load().then((module) => ({ default: pick(module) })));
}

/* Signed-in layouts (sidebar + top bar), mounted once per portal. */
const AdminLayout = lazyPage(
  () => import('./PortalLayouts'),
  (m) => m.AdminLayout,
);
const AdminLanding = lazyPage(
  () => import('./PortalLayouts'),
  (m) => m.AdminLanding,
);
const AdminHub = lazyPage(
  () => import('./PortalLayouts'),
  (m) => m.AdminHub,
);
const AdminSettingsHub = lazyPage(
  () => import('./PortalLayouts'),
  (m) => m.AdminSettingsHub,
);
const ShieldLayout = lazyPage(
  () => import('./PortalLayouts'),
  (m) => m.ShieldLayout,
);

const AdminOverviewPage = lazyPage(
  () => import('../pages/admin/OverviewPage'),
  (m) => m.OverviewPage,
);
const AdminCampaignsPage = lazyPage(
  () => import('../pages/admin/CampaignsPage'),
  (m) => m.CampaignsPage,
);
const AdminCampaignDetailPage = lazyPage(
  () => import('../pages/admin/CampaignDetailPage'),
  (m) => m.CampaignDetailPage,
);
const AdminMessagesPage = lazyPage(
  () => import('../pages/admin/MobileSyncPage'),
  (m) => m.MobileSyncPage,
);
const AdminReportsPage = lazyPage(
  () => import('../pages/admin/ReportsPage'),
  (m) => m.ReportsPage,
);
const AdminSenderReportsPage = lazyPage(
  () => import('../pages/admin/SenderReportsPage'),
  (m) => m.SenderReportsPage,
);
const AdminReviewQueueTab = lazyPage(
  () => import('../pages/admin/model/ReviewQueueTab'),
  (m) => m.ReviewQueueTab,
);
const AdminModelLifecycleTab = lazyPage(
  () => import('../pages/admin/model/ModelLifecycleTab'),
  (m) => m.ModelLifecycleTab,
);
const AdminDriftTab = lazyPage(
  () => import('../pages/admin/model/DriftTab'),
  (m) => m.DriftTab,
);
const AdminDatasetTab = lazyPage(
  () => import('../pages/admin/model/DatasetTab'),
  (m) => m.DatasetTab,
);
const AdminModelErrorsTab = lazyPage(
  () => import('../pages/admin/ModelPage'),
  (m) => m.FpFnTab,
);
const AdminAccessRequestsPage = lazyPage(
  () => import('../pages/admin/AccessRequestsPage'),
  (m) => m.AccessRequestsPage,
);
const AdminUsersPage = lazyPage(
  () => import('../pages/admin/UsersPage'),
  (m) => m.UsersPage,
);
const AdminApiKeysPage = lazyPage(
  () => import('../pages/admin/ApiKeysPage'),
  (m) => m.ApiKeysPage,
);
const AdminTipsPage = lazyPage(
  () => import('../pages/admin/TipsPage'),
  (m) => m.TipsPage,
);
const AdminServerHealthTab = lazyPage(
  () => import('../pages/admin/SystemPage'),
  (m) => m.ServerHealthTab,
);
const AdminApiLogsTab = lazyPage(
  () => import('../pages/admin/SystemPage'),
  (m) => m.ApiLogsTab,
);
const AdminDbStorageTab = lazyPage(
  () => import('../pages/admin/SystemPage'),
  (m) => m.DbStorageTab,
);
const AdminAuditEventsPanel = lazyPage(
  () => import('../pages/admin/AuditPage'),
  (m) => m.AuditEventsPanel,
);
const AdminExportPage = lazyPage(
  () => import('../pages/admin/ExportPage'),
  (m) => m.ExportPage,
);
const AdminProfileSettings = lazyPage(
  () => import('../pages/admin/SettingsPage'),
  (m) => m.ProfileSettings,
);
const AdminNotificationSettings = lazyPage(
  () => import('../pages/admin/SettingsPage'),
  (m) => m.NotificationSettings,
);
const AdminNotificationsInbox = lazyPage(
  () => import('../pages/admin/SettingsPage'),
  (m) => m.NotificationsInbox,
);

const ClientOverviewPage = lazyPage(
  () => import('../pages/client/OverviewPage'),
  (m) => m.OverviewPage,
);
const ClientCampaignsPage = lazyPage(
  () => import('../pages/client/CampaignsPage'),
  (m) => m.CampaignsPage,
);
const ClientCampaignDetailPage = lazyPage(
  () => import('../pages/client/CampaignDetailPage'),
  (m) => m.CampaignDetailPage,
);
const ClientNotificationsPage = lazyPage(
  () => import('../pages/client/SettingsPage'),
  (m) => m.NotificationsPage,
);
const ClientHelpPage = lazyPage(
  () => import('../pages/client/HelpPage'),
  (m) => m.HelpPage,
);
const ClientApiPage = lazyPage(
  () => import('../pages/client/ApiPage'),
  (m) => m.ApiPage,
);
const ClientAccountPage = lazyPage(
  () => import('../pages/client/AccountPage'),
  (m) => m.AccountPage,
);

/*
 * Retired admin URLs → their new home (relative to /admin). Query-string
 * tabs from the old Model and System pages map through the hubs below.
 */
const ADMIN_REDIRECTS: Array<[string, string]> = [
  ['reports', '/admin/review/reports'],
  ['sender-reports', '/admin/review/senders'],
  ['mobile-sync', '/admin/messages'],
  ['classification', '/admin/messages'],
  ['concept-drift', '/admin/model/drift'],
  ['dataset', '/admin/model/dataset'],
  ['fpfn', '/admin/model/errors'],
  ['timeline', '/admin/campaigns'],
  ['access-requests', '/admin/customers/requests'],
  ['users', '/admin/customers/accounts'],
  ['shield-api', '/admin/customers/api'],
  ['audit', '/admin/system/audit'],
  ['export', '/admin/system/exports'],
  ['server', '/admin/system/health'],
  ['api-logs', '/admin/system/logs'],
  ['db-storage', '/admin/system/storage'],
];

const MODEL_LEGACY_TABS: Record<string, string> = {
  overview: '/admin/model/overview',
  drift: '/admin/model/drift',
  dataset: '/admin/model/dataset',
  fpfn: '/admin/model/errors',
  review: '/admin/review/detections',
  classification: '/admin/messages',
};

const SYSTEM_LEGACY_TABS: Record<string, string> = {
  server: '/admin/system/health',
  'api-logs': '/admin/system/logs',
  'db-storage': '/admin/system/storage',
  audit: '/admin/system/audit',
};

const AccountPage = lazyPage(
  () => import('../pages/account/AccountPage'),
  (m) => m.AccountPage,
);
const ActivationPage = lazyPage(
  () => import('../pages/account/ActivationPage'),
  (m) => m.ActivationPage,
);
const ApplicationPage = lazyPage(
  () => import('../pages/account/ApplicationPage'),
  (m) => m.ApplicationPage,
);
const ExpiredPage = lazyPage(
  () => import('../pages/account/ExpiredPage'),
  (m) => m.ExpiredPage,
);
const RequestPage = lazyPage(
  () => import('../pages/account/RequestPage'),
  (m) => m.RequestPage,
);
const SetupPage = lazyPage(
  () => import('../pages/account/SetupPage'),
  (m) => m.SetupPage,
);
const StatusPage = lazyPage(
  () => import('../pages/account/StatusPage'),
  (m) => m.StatusPage,
);

/* Dev-only token surface. Never registered in production builds. */
const TokensPage = import.meta.env.DEV
  ? React.lazy(() => import('../pages/_tokens/TokensPage'))
  : null;

/* Dev-only AppShell preview. */
const ShellPreviewPage = import.meta.env.DEV
  ? React.lazy(() => import('../pages/_shell/ShellPreviewPage'))
  : null;

/* Dev-only primitives preview. */
const PrimitivesPage = import.meta.env.DEV
  ? React.lazy(() => import('../pages/_primitives/PrimitivesPage'))
  : null;

/*
 * Every signed-in route declares its lifecycle route group. LifecycleRoute
 * redirects any state that may not reach the group to that state's single
 * allowed destination (server-resolved; deny by default).
 */
function lifecycle(group: RouteGroup, page: React.ReactNode) {
  return (
    <LifecycleRoute group={group}>
      <React.Suspense
        fallback={<LoadingState label="Loading page" fullScreen />}
      >
        {page}
      </React.Suspense>
    </LifecycleRoute>
  );
}

function clientPage(page: React.ReactNode) {
  return lifecycle('workspace', page);
}

function adminPage(page: React.ReactNode) {
  return lifecycle('admin', page);
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public — single scrollable landing page. Legacy paths redirect. */}
      <Route
        path="/"
        element={
          <SetupGate>
            <LandingPage />
          </SetupGate>
        }
      />
      <Route
        path="/how-it-works"
        element={<Navigate to="/#how-it-works" replace />}
      />
      <Route path="/about" element={<Navigate to="/#about" replace />} />
      <Route path="/research" element={<Navigate to="/" replace />} />
      {/* Public plan selection. Choosing a plan starts account-first
          registration; signed-in visitors go to their current state. */}
      <Route
        path="/request-access"
        element={
          <SignedOutOnly>
            <RequestAccessPage />
          </SignedOutOnly>
        }
      />
      {/* Retired anonymous checkout/claim pages (account-first lifecycle):
          activation now happens while signed in. Old links still resolve. */}
      <Route
        path="/request-access/checkout"
        element={<Navigate to="/activation" replace />}
      />
      <Route
        path="/request-access/pending"
        element={<Navigate to="/activation" replace />}
      />
      <Route
        path="/request-access/cancelled"
        element={<Navigate to="/activation" replace />}
      />
      <Route
        path="/request-access/setup"
        element={<Navigate to="/signup" replace />}
      />

      {/* One sign-in page for everyone; one account-first registration. */}
      <Route
        path="/login"
        element={
          <SignedOutOnly>
            <LoginPage />
          </SignedOutOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <SignedOutOnly>
            <SignUpPage />
          </SignedOutOnly>
        }
      />
      <Route path="/admin-login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route
        path="/forgot-password"
        element={<Navigate to="/login" replace />}
      />

      {/* Signed-in account lifecycle (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md). */}
      <Route path="/setup" element={lifecycle('setup', <SetupPage />)} />
      <Route
        path="/access/request"
        element={lifecycle('request', <RequestPage />)}
      />
      <Route
        path="/application"
        element={lifecycle('application', <ApplicationPage />)}
      />
      <Route
        path="/activation"
        element={lifecycle('activation', <ActivationPage />)}
      />
      <Route
        path="/access/expired"
        element={lifecycle('expired', <ExpiredPage />)}
      />
      <Route
        path="/access/status"
        element={lifecycle('status', <StatusPage />)}
      />
      <Route path="/account" element={lifecycle('account', <AccountPage />)} />

      {/* Legacy phone-OTP page. Portal sessions are email + cookie only; the
          phone route issues the Android app's bearer token, which the web
          never stores or sends. */}
      <Route path="/2fa" element={<Navigate to="/login" replace />} />

      {/* Account Pages */}
      <Route path="/profile" element={<Navigate to="/account" replace />} />
      <Route path="/settings" element={<Navigate to="/account" replace />} />

      {/* Shield portal: one layout around every screen. Approved campaign
          intelligence only; account and notifications sit in the top bar. */}
      <Route path="/shield" element={clientPage(<ShieldLayout />)}>
        <Route index element={<Navigate to="/shield/overview" replace />} />
        <Route path="overview" element={<ClientOverviewPage />} />
        <Route path="campaigns" element={<ClientCampaignsPage />} />
        <Route path="campaigns/:id" element={<ClientCampaignDetailPage />} />
        <Route path="api" element={<ClientApiPage />} />
        <Route path="notifications" element={<ClientNotificationsPage />} />
        <Route path="documentation" element={<ClientHelpPage />} />
        <Route path="account" element={<ClientAccountPage />} />
        {/* Export is now an action on each campaign. */}
        <Route
          path="exports"
          element={<Navigate to="/shield/campaigns" replace />}
        />
      </Route>

      {/* Legacy client URLs are retained as safe redirects while server-side
          authorization migrates. No retired data surface remains mounted. */}
      <Route
        path="/client/overview"
        element={<Navigate to="/shield/overview" replace />}
      />
      <Route
        path="/client/messages"
        element={<Navigate to="/shield/overview" replace />}
      />
      <Route
        path="/client/campaigns"
        element={<Navigate to="/shield/campaigns" replace />}
      />
      <Route
        path="/client/campaigns/:id"
        element={<Navigate to="/shield/campaigns" replace />}
      />
      {/* Analytics is admin-only on the backend. Old links go to Overview. */}
      <Route
        path="/client/analytics"
        element={<Navigate to="/shield/overview" replace />}
      />
      <Route
        path="/client/export"
        element={<Navigate to="/shield/campaigns" replace />}
      />
      <Route
        path="/client/help"
        element={<Navigate to="/shield/documentation" replace />}
      />
      <Route
        path="/client/settings"
        element={<Navigate to="/account" replace />}
      />
      <Route
        path="/client/notifications"
        element={<Navigate to="/shield/notifications" replace />}
      />

      {/* Admin portal: one layout (sidebar + top bar) around every screen.
          Hubs (Review, Model, Customers, System, Settings) show their
          screens as URL tabs; see src/navigation/portalNav.tsx. */}
      <Route path="/admin" element={adminPage(<AdminLayout />)}>
        <Route index element={<AdminLanding />} />
        <Route path="overview" element={<AdminOverviewPage />} />
        <Route path="review" element={<AdminHub id="review" />}>
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="senders" element={<AdminSenderReportsPage />} />
          <Route path="detections" element={<AdminReviewQueueTab />} />
        </Route>
        <Route path="campaigns" element={<AdminCampaignsPage />} />
        <Route path="campaigns/:id" element={<AdminCampaignDetailPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route
          path="model"
          element={<AdminHub id="model" legacyTabs={MODEL_LEGACY_TABS} />}
        >
          <Route path="overview" element={<AdminModelLifecycleTab />} />
          <Route path="drift" element={<AdminDriftTab />} />
          <Route path="dataset" element={<AdminDatasetTab />} />
          <Route path="errors" element={<AdminModelErrorsTab />} />
        </Route>
        <Route path="customers" element={<AdminHub id="customers" />}>
          <Route path="requests" element={<AdminAccessRequestsPage />} />
          <Route path="accounts" element={<AdminUsersPage />} />
          <Route path="api" element={<AdminApiKeysPage />} />
        </Route>
        <Route path="tips" element={<AdminTipsPage />} />
        <Route
          path="system"
          element={<AdminHub id="system" legacyTabs={SYSTEM_LEGACY_TABS} />}
        >
          <Route path="health" element={<AdminServerHealthTab />} />
          <Route path="logs" element={<AdminApiLogsTab />} />
          <Route path="storage" element={<AdminDbStorageTab />} />
          <Route path="audit" element={<AdminAuditEventsPanel />} />
          <Route path="exports" element={<AdminExportPage />} />
        </Route>
        <Route path="settings" element={<AdminSettingsHub />}>
          <Route path="profile" element={<AdminProfileSettings />} />
          <Route path="notifications" element={<AdminNotificationSettings />} />
        </Route>
        <Route path="notifications" element={<AdminNotificationsInbox />} />

        {/* Old admin URLs (bookmarks, docs, thesis screenshots) keep working. */}
        {ADMIN_REDIRECTS.map(([from, to]) => (
          <Route
            key={from}
            path={from}
            element={<Navigate to={to} replace />}
          />
        ))}
      </Route>

      {/* Dev-only design token surface */}
      {TokensPage && (
        <Route
          path="/_tokens"
          element={
            <React.Suspense fallback={null}>
              <TokensPage />
            </React.Suspense>
          }
        />
      )}

      {/* Dev-only AppShell preview */}
      {ShellPreviewPage && (
        <Route
          path="/_shell/*"
          element={
            <React.Suspense fallback={null}>
              <ShellPreviewPage />
            </React.Suspense>
          }
        />
      )}

      {/* Dev-only primitives preview */}
      {PrimitivesPage && (
        <Route
          path="/_primitives"
          element={
            <React.Suspense fallback={null}>
              <PrimitivesPage />
            </React.Suspense>
          }
        />
      )}

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
