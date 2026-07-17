import { Navigate, Route, Routes } from "react-router-dom";
import {
  AdminCampaignsPage,
  AdminClassificationPage,
  AdminConceptDriftPage,
  AdminDatasetPage,
  AdminExportPage,
  AdminFpFnPage,
  AdminModelPage,
  AdminOverviewPage,
  AdminReportsPage,
  AdminServerPage,
  AdminSettingsPage,
  AdminTimelinePage,
  AdminTipsPage,
  AdminUsersPage,
} from "../pages/admin";
import {
  ClientAnalyticsPage,
  ClientCampaignsPage,
  ClientExportPage,
  ClientHelpPage,
  ClientMessagesPage,
  ClientOverviewPage,
  ClientSettingsPage,
} from "../pages/client";
import {
  LandingPage,
  LoginPage,
  RequestAccessPage,
  TwoFactorPage,
} from "../pages/public";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<LoginPage admin />} />
      <Route path="/2fa" element={<TwoFactorPage />} />

      <Route path="/client/overview" element={<ClientOverviewPage />} />
      <Route path="/client/messages" element={<ClientMessagesPage />} />
      <Route path="/client/campaigns" element={<ClientCampaignsPage />} />
      <Route path="/client/analytics" element={<ClientAnalyticsPage />} />
      <Route path="/client/export" element={<ClientExportPage />} />
      <Route path="/client/help" element={<ClientHelpPage />} />
      <Route path="/client/settings" element={<ClientSettingsPage />} />
      <Route path="/client/notifications" element={<ClientSettingsPage notifications />} />

      <Route path="/admin/overview" element={<AdminOverviewPage />} />
      <Route path="/admin/reports" element={<AdminReportsPage />} />
      <Route path="/admin/model" element={<AdminModelPage />} />
      <Route path="/admin/concept-drift" element={<AdminConceptDriftPage />} />
      <Route path="/admin/dataset" element={<AdminDatasetPage />} />
      <Route path="/admin/classification" element={<AdminClassificationPage />} />
      <Route path="/admin/fpfn" element={<AdminFpFnPage />} />
      <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
      <Route path="/admin/timeline" element={<AdminTimelinePage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/export" element={<AdminExportPage />} />
      <Route path="/admin/server" element={<AdminServerPage tab="server" />} />
      <Route path="/admin/api-logs" element={<AdminServerPage tab="api" />} />
      <Route path="/admin/db-storage" element={<AdminServerPage tab="db" />} />
      <Route path="/admin/tips" element={<AdminTipsPage />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/admin/notifications" element={<AdminSettingsPage notifications />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
