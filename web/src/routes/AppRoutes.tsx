import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import {
  AdminApiLogsPage,
  AdminCampaignsPage,
  AdminClassificationPage,
  AdminConceptDriftPage,
  AdminDatasetPage,
  AdminDbStoragePage,
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
} from '../pages/admin';
import {
  ClientAnalyticsPage,
  ClientCampaignsPage,
  ClientExportPage,
  ClientHelpPage,
  ClientMessagesPage,
  ClientOverviewPage,
  ClientSettingsPage,
} from '../pages/client';

import { AboutPage } from '../pages/About/index';
import { AdminLoginPage } from '../pages/AdminLogin';
import { ForgotPasswordPage } from '../pages/ForgotPassword';
import { HowItWorksPage } from '../pages/HowItWorks/index';
import { LandingPage, RequestAccessPage } from '../pages/public';
import { LoginPage } from '../pages/Login';
import { ProfilePage } from '../pages/Profile';
import { ResearchPage } from '../pages/Research/index';
import { SettingsPage } from '../pages/Settings';
import { TwoFactorPage } from '../pages/TwoFactor';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/research" element={<ResearchPage />} />
      <Route path="/request-access" element={<RequestAccessPage />} />

      {/* Auth Pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/2fa" element={<TwoFactorPage />} />

      {/* Account Pages */}
      <Route path="/profile" element={<Navigate to="/client/settings" replace />} />
      <Route path="/settings" element={<Navigate to="/client/settings" replace />} />

      {/* Client Portal Routes */}
      <Route path="/client/overview" element={<ClientOverviewPage />} />
      <Route path="/client/messages" element={<ClientMessagesPage />} />
      <Route path="/client/campaigns" element={<ClientCampaignsPage />} />
      <Route path="/client/analytics" element={<ClientAnalyticsPage />} />
      <Route path="/client/export" element={<ClientExportPage />} />
      <Route path="/client/help" element={<ClientHelpPage />} />
      <Route path="/client/settings" element={<ClientSettingsPage />} />
      <Route path="/client/notifications" element={<ClientSettingsPage notifications />} />

      {/* Admin Portal Routes */}
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
      <Route path="/admin/api-logs" element={<AdminApiLogsPage />} />
      <Route path="/admin/db-storage" element={<AdminDbStoragePage />} />
      <Route path="/admin/tips" element={<AdminTipsPage />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/admin/notifications" element={<AdminSettingsPage notifications />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
