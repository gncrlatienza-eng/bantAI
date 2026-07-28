import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
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
import { HowItWorksPage } from "../pages/HowItWorks";
import { AboutPage } from "../pages/About";
import { ResearchPage } from "../pages/Research";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/research" element={<ResearchPage />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<LoginPage admin />} />
      <Route path="/2fa" element={<TwoFactorPage />} />

      <Route path="/client/overview" element={<ProtectedRoute role="client"><ClientOverviewPage /></ProtectedRoute>} />
      <Route path="/client/messages" element={<ProtectedRoute role="client"><ClientMessagesPage /></ProtectedRoute>} />
      <Route path="/client/campaigns" element={<ProtectedRoute role="client"><ClientCampaignsPage /></ProtectedRoute>} />
      <Route path="/client/analytics" element={<ProtectedRoute role="client"><ClientAnalyticsPage /></ProtectedRoute>} />
      <Route path="/client/export" element={<ProtectedRoute role="client"><ClientExportPage /></ProtectedRoute>} />
      <Route path="/client/help" element={<ProtectedRoute role="client"><ClientHelpPage /></ProtectedRoute>} />
      <Route path="/client/settings" element={<ProtectedRoute role="client"><ClientSettingsPage /></ProtectedRoute>} />
      <Route path="/client/notifications" element={<ProtectedRoute role="client"><ClientSettingsPage notifications /></ProtectedRoute>} />

      <Route path="/admin/overview" element={<ProtectedRoute role="admin"><AdminOverviewPage /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute role="admin"><AdminReportsPage /></ProtectedRoute>} />
      <Route path="/admin/model" element={<ProtectedRoute role="admin"><AdminModelPage /></ProtectedRoute>} />
      <Route path="/admin/concept-drift" element={<ProtectedRoute role="admin"><AdminConceptDriftPage /></ProtectedRoute>} />
      <Route path="/admin/dataset" element={<ProtectedRoute role="admin"><AdminDatasetPage /></ProtectedRoute>} />
      <Route path="/admin/classification" element={<ProtectedRoute role="admin"><AdminClassificationPage /></ProtectedRoute>} />
      <Route path="/admin/fpfn" element={<ProtectedRoute role="admin"><AdminFpFnPage /></ProtectedRoute>} />
      <Route path="/admin/campaigns" element={<ProtectedRoute role="admin"><AdminCampaignsPage /></ProtectedRoute>} />
      <Route path="/admin/timeline" element={<ProtectedRoute role="admin"><AdminTimelinePage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute role="admin"><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/export" element={<ProtectedRoute role="admin"><AdminExportPage /></ProtectedRoute>} />
      <Route path="/admin/server" element={<ProtectedRoute role="admin"><AdminServerPage tab="server" /></ProtectedRoute>} />
      <Route path="/admin/api-logs" element={<ProtectedRoute role="admin"><AdminServerPage tab="api" /></ProtectedRoute>} />
      <Route path="/admin/db-storage" element={<ProtectedRoute role="admin"><AdminServerPage tab="db" /></ProtectedRoute>} />
      <Route path="/admin/tips" element={<ProtectedRoute role="admin"><AdminTipsPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute role="admin"><AdminSettingsPage notifications /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
