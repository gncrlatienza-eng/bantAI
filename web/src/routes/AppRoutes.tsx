import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

/*
 * All admin and client pages live under pages/admin/ and pages/client/ on
 * the mineral AppShell. The legacy megafiles have been removed.
 */
import { OverviewPage as AdminOverviewPage } from '../pages/admin/OverviewPage';
import { CampaignsPage as AdminCampaignsPage } from '../pages/admin/CampaignsPage';
import { CampaignDetailPage as AdminCampaignDetailPage } from '../pages/admin/CampaignDetailPage';
import { ModelPage as AdminModelPage } from '../pages/admin/ModelPage';
import { SystemPage as AdminSystemPage } from '../pages/admin/SystemPage';
import { ReportsPage as AdminReportsPage } from '../pages/admin/ReportsPage';
import { UsersPage as AdminUsersPage } from '../pages/admin/UsersPage';
import { SettingsPage as AdminSettingsPage } from '../pages/admin/SettingsPage';
import { ExportPage as AdminExportPage } from '../pages/admin/ExportPage';
import { TipsPage as AdminTipsPage } from '../pages/admin/TipsPage';

import { OverviewPage as ClientOverviewPage } from '../pages/client/OverviewPage';
import { CampaignsPage as ClientCampaignsPage } from '../pages/client/CampaignsPage';
import { CampaignDetailPage as ClientCampaignDetailPage } from '../pages/client/CampaignDetailPage';
import { MessagesPage as ClientMessagesPage } from '../pages/client/MessagesPage';
import { AnalyticsPage as ClientAnalyticsPage } from '../pages/client/AnalyticsPage';
import { SettingsPage as ClientSettingsPage } from '../pages/client/SettingsPage';
import { HelpPage as ClientHelpPage } from '../pages/client/HelpPage';
import { ExportPage as ClientExportPage } from '../pages/client/ExportPage';

import { LandingPage, RequestAccessPage } from '../pages/public';
import { CheckoutConfirmationPage } from '../pages/RequestAccess/CheckoutConfirmationPage';
import {
  CheckoutCancelledPage,
  CheckoutPendingPage,
} from '../pages/RequestAccess/CheckoutPendingPage';
import { LegalDisclosuresPage } from '../pages/Legal/LegalDisclosuresPage';
import { ClientLoginPage, AdminLoginPage } from '../pages/Login';
import { TwoFactorPage } from '../pages/TwoFactor';
import { ProtectedRoute } from './ProtectedRoute';

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

function clientPage(page: React.ReactNode) {
  return <ProtectedRoute role="client">{page}</ProtectedRoute>;
}

function adminPage(page: React.ReactNode) {
  return <ProtectedRoute role="admin">{page}</ProtectedRoute>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public — single scrollable landing page. Legacy paths redirect. */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/how-it-works"
        element={<Navigate to="/#how-it-works" replace />}
      />
      <Route path="/about" element={<Navigate to="/#about" replace />} />
      <Route path="/research" element={<Navigate to="/" replace />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      {/* Approved applicants land here from the emailed link. */}
      <Route
        path="/request-access/checkout"
        element={<CheckoutConfirmationPage />}
      />
      {/* Stripe success_url and cancel_url land here — neither grants access. */}
      <Route path="/request-access/pending" element={<CheckoutPendingPage />} />
      <Route
        path="/request-access/cancelled"
        element={<CheckoutCancelledPage />}
      />

      {/* Commerce & Legal Disclosures */}
      <Route path="/legal" element={<LegalDisclosuresPage />} />
      <Route path="/terms" element={<Navigate to="/legal?tab=terms" replace />} />
      <Route path="/privacy" element={<Navigate to="/legal?tab=privacy" replace />} />
      <Route path="/license-terms" element={<Navigate to="/legal?tab=license" replace />} />
      <Route path="/disclosures" element={<Navigate to="/legal" replace />} />

      {/* Auth Pages — Separated login flows */}
      <Route path="/login" element={<ClientLoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route
        path="/register"
        element={<Navigate to="/request-access" replace />}
      />
      <Route
        path="/forgot-password"
        element={<Navigate to="/login" replace />}
      />
      <Route path="/2fa" element={<TwoFactorPage />} />

      {/* Account Pages */}
      <Route
        path="/profile"
        element={<Navigate to="/client/settings" replace />}
      />
      <Route
        path="/settings"
        element={<Navigate to="/client/settings" replace />}
      />

      {/* Client Portal Routes */}
      <Route
        path="/client/overview"
        element={clientPage(<ClientOverviewPage />)}
      />
      <Route
        path="/client/messages"
        element={clientPage(<ClientMessagesPage />)}
      />
      <Route
        path="/client/campaigns"
        element={clientPage(<ClientCampaignsPage />)}
      />
      <Route
        path="/client/campaigns/:id"
        element={clientPage(<ClientCampaignDetailPage />)}
      />
      <Route
        path="/client/analytics"
        element={clientPage(<ClientAnalyticsPage />)}
      />
      <Route path="/client/export" element={clientPage(<ClientExportPage />)} />
      <Route path="/client/help" element={clientPage(<ClientHelpPage />)} />
      <Route
        path="/client/settings"
        element={clientPage(<ClientSettingsPage />)}
      />
      <Route
        path="/client/notifications"
        element={clientPage(<ClientSettingsPage notifications />)}
      />

      {/* Admin Portal Routes */}
      <Route
        path="/admin/overview"
        element={adminPage(<AdminOverviewPage />)}
      />
      <Route path="/admin/reports" element={adminPage(<AdminReportsPage />)} />
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
