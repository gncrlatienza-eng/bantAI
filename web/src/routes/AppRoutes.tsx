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
const AdminModelPage = lazyPage(
  () => import('../pages/admin/ModelPage'),
  (m) => m.ModelPage,
);
const AdminSystemPage = lazyPage(
  () => import('../pages/admin/SystemPage'),
  (m) => m.SystemPage,
);
const AdminReportsPage = lazyPage(
  () => import('../pages/admin/ReportsPage'),
  (m) => m.ReportsPage,
);
const AdminSenderReportsPage = lazyPage(
  () => import('../pages/admin/SenderReportsPage'),
  (m) => m.SenderReportsPage,
);
const AdminUsersPage = lazyPage(
  () => import('../pages/admin/UsersPage'),
  (m) => m.UsersPage,
);
const AdminSettingsPage = lazyPage(
  () => import('../pages/admin/SettingsPage'),
  (m) => m.SettingsPage,
);
const AdminExportPage = lazyPage(
  () => import('../pages/admin/ExportPage'),
  (m) => m.ExportPage,
);
const AdminTipsPage = lazyPage(
  () => import('../pages/admin/TipsPage'),
  (m) => m.TipsPage,
);
const AdminMobileSyncPage = lazyPage(
  () => import('../pages/admin/MobileSyncPage'),
  (m) => m.MobileSyncPage,
);
const AdminAccessRequestsPage = lazyPage(
  () => import('../pages/admin/AccessRequestsPage'),
  (m) => m.AccessRequestsPage,
);
const AdminApiKeysPage = lazyPage(
  () => import('../pages/admin/ApiKeysPage'),
  (m) => m.ApiKeysPage,
);
const AdminAuditPage = lazyPage(
  () => import('../pages/admin/AuditPage'),
  (m) => m.AuditPage,
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
const ClientSettingsPage = lazyPage(
  () => import('../pages/client/SettingsPage'),
  (m) => m.SettingsPage,
);
const ClientHelpPage = lazyPage(
  () => import('../pages/client/HelpPage'),
  (m) => m.HelpPage,
);
const ClientExportPage = lazyPage(
  () => import('../pages/client/ExportPage'),
  (m) => m.ExportPage,
);
const ClientApiPage = lazyPage(
  () => import('../pages/client/ApiPage'),
  (m) => m.ApiPage,
);

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
      <React.Suspense fallback={<LoadingState label="Loading page" />}>
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

      {/* Shield portal. These client-named components remain only as a source
          folder during the migration; the public information architecture is
          Shield and contains approved campaign intelligence only. */}
      <Route
        path="/shield"
        element={<Navigate to="/shield/overview" replace />}
      />
      <Route
        path="/shield/overview"
        element={clientPage(<ClientOverviewPage />)}
      />
      <Route
        path="/shield/campaigns"
        element={clientPage(<ClientCampaignsPage />)}
      />
      <Route
        path="/shield/campaigns/:id"
        element={clientPage(<ClientCampaignDetailPage />)}
      />
      <Route path="/shield/api" element={clientPage(<ClientApiPage />)} />
      <Route
        path="/shield/exports"
        element={clientPage(<ClientExportPage />)}
      />
      <Route
        path="/shield/notifications"
        element={clientPage(<ClientSettingsPage notifications />)}
      />
      <Route
        path="/shield/documentation"
        element={clientPage(<ClientHelpPage />)}
      />

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
        element={<Navigate to="/shield/exports" replace />}
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

      {/* Admin Portal Routes */}
      <Route
        path="/admin/overview"
        element={adminPage(<AdminOverviewPage />)}
      />
      <Route path="/admin/reports" element={adminPage(<AdminReportsPage />)} />
      <Route
        path="/admin/sender-reports"
        element={adminPage(<AdminSenderReportsPage />)}
      />
      <Route
        path="/admin/mobile-sync"
        element={adminPage(<AdminMobileSyncPage />)}
      />
      <Route path="/admin/model" element={adminPage(<AdminModelPage />)} />
      {/* Model sub-routes now live as tabs on /admin/model. Deep links redirect. */}
      <Route
        path="/admin/concept-drift"
        element={<Navigate to="/admin/model?tab=drift" replace />}
      />
      <Route
        path="/admin/dataset"
        element={<Navigate to="/admin/model?tab=dataset" replace />}
      />
      <Route
        path="/admin/classification"
        element={<Navigate to="/admin/model?tab=classification" replace />}
      />
      <Route
        path="/admin/fpfn"
        element={<Navigate to="/admin/model?tab=fpfn" replace />}
      />
      <Route
        path="/admin/campaigns"
        element={adminPage(<AdminCampaignsPage />)}
      />
      <Route
        path="/admin/campaigns/:id"
        element={adminPage(<AdminCampaignDetailPage />)}
      />
      {/* Timeline was a chronological list of campaigns; the Campaign Detail
          absorbs the drill-down and Campaigns list gives the flat view. */}
      <Route
        path="/admin/timeline"
        element={<Navigate to="/admin/campaigns" replace />}
      />
      <Route path="/admin/users" element={adminPage(<AdminUsersPage />)} />
      <Route
        path="/admin/shield-api"
        element={adminPage(<AdminApiKeysPage />)}
      />
      <Route path="/admin/audit" element={adminPage(<AdminAuditPage />)} />
      <Route
        path="/admin/access-requests"
        element={adminPage(<AdminAccessRequestsPage />)}
      />
      <Route path="/admin/export" element={adminPage(<AdminExportPage />)} />
      <Route path="/admin/system" element={adminPage(<AdminSystemPage />)} />
      {/* System sub-routes now live as tabs on /admin/system. Deep links redirect. */}
      <Route
        path="/admin/server"
        element={<Navigate to="/admin/system" replace />}
      />
      <Route
        path="/admin/api-logs"
        element={<Navigate to="/admin/system?tab=api-logs" replace />}
      />
      <Route
        path="/admin/db-storage"
        element={<Navigate to="/admin/system?tab=db-storage" replace />}
      />
      <Route path="/admin/tips" element={adminPage(<AdminTipsPage />)} />
      <Route
        path="/admin/settings"
        element={adminPage(<AdminSettingsPage />)}
      />
      <Route
        path="/admin/notifications"
        element={adminPage(<AdminSettingsPage notifications />)}
      />

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
