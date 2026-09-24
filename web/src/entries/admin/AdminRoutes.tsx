import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

/*
 * Internal Admin Portal Routes — Dedicated to staff administration and triage.
 */
import { OverviewPage as AdminOverviewPage } from '../../pages/admin/OverviewPage';
import { CampaignsPage as AdminCampaignsPage } from '../../pages/admin/CampaignsPage';
import { CampaignDetailPage as AdminCampaignDetailPage } from '../../pages/admin/CampaignDetailPage';
import { ModelPage as AdminModelPage } from '../../pages/admin/ModelPage';
import { SystemPage as AdminSystemPage } from '../../pages/admin/SystemPage';
import { ReportsPage as AdminReportsPage } from '../../pages/admin/ReportsPage';
import { UsersPage as AdminUsersPage } from '../../pages/admin/UsersPage';
import { SettingsPage as AdminSettingsPage } from '../../pages/admin/SettingsPage';
import { ExportPage as AdminExportPage } from '../../pages/admin/ExportPage';
import { TipsPage as AdminTipsPage } from '../../pages/admin/TipsPage';

import { AdminLoginPage } from '../../pages/Login/AdminLoginPage';
import { TwoFactorPage } from '../../pages/TwoFactor';
import { AdminProtectedRoute } from '../../routes/AdminProtectedRoute';
import { StaffPermissionGate } from '../../components/common/StaffPermissionGate';

/* Dev-only token surface. Never registered in production builds. */
const TokensPage = import.meta.env.DEV
  ? React.lazy(() => import('../../pages/_tokens/TokensPage'))
  : null;

/* Dev-only AppShell preview. */
const ShellPreviewPage = import.meta.env.DEV
  ? React.lazy(() => import('../../pages/_shell/ShellPreviewPage'))
  : null;

/* Dev-only primitives preview. */
const PrimitivesPage = import.meta.env.DEV
  ? React.lazy(() => import('../../pages/_primitives/PrimitivesPage'))
  : null;

function staffPage(page: React.ReactNode, permission: string) {
  return (
    <AdminProtectedRoute>
      <StaffPermissionGate requiredPermission={permission}>
        {page}
      </StaffPermissionGate>
    </AdminProtectedRoute>
  );
}

export function AdminRoutes() {
  return (
    <Routes>
      {/* Staff Authentication with MFA */}
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/2fa" element={<TwoFactorPage />} />
      <Route path="/" element={<Navigate to="/admin/overview" replace />} />

      {/* Admin Portal Routes with Least-Privilege Permission Gating */}
      <Route
        path="/admin/overview"
        element={staffPage(<AdminOverviewPage />, 'overview:read')}
      />
      <Route
        path="/admin/reports"
        element={staffPage(<AdminReportsPage />, 'reports:read')}
      />
      <Route
        path="/admin/model"
        element={staffPage(<AdminModelPage />, 'models:read')}
      />
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
        element={staffPage(<AdminCampaignsPage />, 'campaigns:read')}
      />
      <Route
        path="/admin/campaigns/:id"
        element={staffPage(<AdminCampaignDetailPage />, 'campaigns:read')}
      />
      <Route
        path="/admin/timeline"
        element={<Navigate to="/admin/campaigns" replace />}
      />
      <Route
        path="/admin/users"
        element={staffPage(<AdminUsersPage />, 'overview:read')}
      />
      <Route
        path="/admin/export"
        element={staffPage(<AdminExportPage />, 'privacy:read')}
      />
      <Route
        path="/admin/system"
        element={staffPage(<AdminSystemPage />, 'system:read')}
      />
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
      <Route
        path="/admin/tips"
        element={staffPage(<AdminTipsPage />, 'verification:read')}
      />
      <Route
        path="/admin/settings"
        element={staffPage(<AdminSettingsPage />, 'overview:read')}
      />
      <Route
        path="/admin/notifications"
        element={staffPage(<AdminSettingsPage notifications />, 'overview:read')}
      />

      {/* Dev-only surfaces */}
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

      {/* Catch-all redirect to admin overview */}
      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Routes>
  );
}
