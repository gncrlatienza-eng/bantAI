import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

/*
 * Client Portal Routes — Strictly imports ONLY client pages and client auth.
 * Zero imports or registration of Admin pages.
 */
import { OverviewPage as ClientOverviewPage } from '../../pages/client/OverviewPage';
import { CampaignsPage as ClientCampaignsPage } from '../../pages/client/CampaignsPage';
import { CampaignDetailPage as ClientCampaignDetailPage } from '../../pages/client/CampaignDetailPage';
import { MessagesPage as ClientMessagesPage } from '../../pages/client/MessagesPage';
import { AnalyticsPage as ClientAnalyticsPage } from '../../pages/client/AnalyticsPage';
import { SettingsPage as ClientSettingsPage } from '../../pages/client/SettingsPage';
import { HelpPage as ClientHelpPage } from '../../pages/client/HelpPage';
import { ExportPage as ClientExportPage } from '../../pages/client/ExportPage';
import { WorkspacePage as ClientWorkspacePage } from '../../pages/client/WorkspacePage';

import { ClientLoginPage } from '../../pages/Login/ClientLoginPage';
import { ClientProtectedRoute } from '../../routes/ClientProtectedRoute';

function clientPage(page: React.ReactNode) {
  return <ClientProtectedRoute>{page}</ClientProtectedRoute>;
}

export function ClientRoutes() {
  return (
    <Routes>
      {/* Client Authentication */}
      <Route path="/login" element={<ClientLoginPage />} />
      <Route path="/" element={<Navigate to="/client/overview" replace />} />

      {/* Account Settings Aliases */}
      <Route
        path="/profile"
        element={<Navigate to="/client/settings" replace />}
      />
      <Route
        path="/settings"
        element={<Navigate to="/client/settings" replace />}
      />
      <Route
        path="/workspace"
        element={<Navigate to="/client/workspace" replace />}
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
      <Route path="/client/workspace" element={clientPage(<ClientWorkspacePage />)} />
      <Route path="/client/help" element={clientPage(<ClientHelpPage />)} />
      <Route
        path="/client/settings"
        element={clientPage(<ClientSettingsPage />)}
      />
      <Route
        path="/client/notifications"
        element={clientPage(<ClientSettingsPage notifications />)}
      />

      {/* Catch-all redirect to client overview */}
      <Route path="*" element={<Navigate to="/client/overview" replace />} />
    </Routes>
  );
}
