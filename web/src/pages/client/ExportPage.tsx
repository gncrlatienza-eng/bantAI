/*
 * Client Export page — placeholder pending server-generated exports.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button, EmptyState, InfoBadge } from '../../components/primitives';
import { logout } from '../../services/authService';
import { CLIENT_SIDEBAR_GROUPS } from './clientNav';

export function ExportPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      role="client"
      groups={CLIENT_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Operations &middot; Export</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>Authenticated account</span>
      }
    >
      <PageHeader
        title="Export"
        description="Download a copy of your alerts and reports for record-keeping."
      />
      <EmptyState
        title="Client exports not connected"
        description="Server-generated exports scoped to your account require an authenticated endpoint that has not shipped yet."
        action={
          <InfoBadge>Requires GET /users/me/export on the backend</InfoBadge>
        }
      />
    </AppShell>
  );
}

export default ExportPage;
