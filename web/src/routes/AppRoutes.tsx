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
import { ResearchPage } from '../pages/Research/index';
import { TwoFactorPage } from '../pages/TwoFactor';
import { ProtectedRoute } from './ProtectedRoute';

function clientPage(page: React.ReactNode) {
  return <ProtectedRoute role="client">{page}</ProtectedRoute>;
}

function adminPage(page: React.ReactNode) {
  return <ProtectedRoute role="admin">{page}</ProtectedRoute>;
}

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
      <Route
        path="/profile"
        element={<Navigate to="/client/settings" replace />}
      />
      <Route
        path="/settings"
        element={<Navigate to="/client/settings" replace />}
      />

      {/* Client Portal Routes */}
      <Route path="/client/overview" element={clientPage(<ClientOverviewPage />)} />
      <Route path="/client/messages" element={clientPage(<ClientMessagesPage />)} />
      <Route path="/client/campaigns" element={clientPage(<ClientCampaignsPage />)} />
      <Route path="/client/analytics" element={clientPage(<ClientAnalyticsPage />)} />
      <Route path="/client/export" element={clientPage(<ClientExportPage />)} />
      <Route path="/client/help" element={clientPage(<ClientHelpPage />)} />
      <Route path="/client/settings" element={clientPage(<ClientSettingsPage />)} />
      <Route
        path="/client/notifications"
        element={clientPage(<ClientSettingsPage notifications />)}
      />

      {/* Admin Portal Routes */}
      <Route path="/admin/overview" element={adminPage(<AdminOverviewPage />)} />
      <Route path="/admin/reports" element={adminPage(<AdminReportsPage />)} />
      <Route path="/admin/model" element={adminPage(<AdminModelPage />)} />
      <Route path="/admin/concept-drift" element={adminPage(<AdminConceptDriftPage />)} />
      <Route path="/admin/dataset" element={adminPage(<AdminDatasetPage />)} />
      <Route
        path="/admin/classification"
        element={adminPage(<AdminClassificationPage />)}
      />
      <Route path="/admin/fpfn" element={adminPage(<AdminFpFnPage />)} />
      <Route path="/admin/campaigns" element={adminPage(<AdminCampaignsPage />)} />
      <Route path="/admin/timeline" element={adminPage(<AdminTimelinePage />)} />
      <Route path="/admin/users" element={adminPage(<AdminUsersPage />)} />
      <Route path="/admin/export" element={adminPage(<AdminExportPage />)} />
      <Route path="/admin/server" element={adminPage(<AdminServerPage tab="server" />)} />
      <Route path="/admin/api-logs" element={adminPage(<AdminApiLogsPage />)} />
      <Route path="/admin/db-storage" element={adminPage(<AdminDbStoragePage />)} />
      <Route path="/admin/tips" element={adminPage(<AdminTipsPage />)} />
      <Route path="/admin/settings" element={adminPage(<AdminSettingsPage />)} />
      <Route
        path="/admin/notifications"
        element={adminPage(<AdminSettingsPage notifications />)}
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
