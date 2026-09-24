/*
 * Client Help page — placeholder pending backend content endpoint.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button, EmptyState, InfoBadge } from '../../components/primitives';
import { logout } from '../../services/authService';
import { CLIENT_SIDEBAR_GROUPS } from './clientNav';

export function HelpPage() {
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
      topbarContext={<span>Operations &middot; Help</span>}
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
        <span style={{ fontSize: '0.85rem' }}>Authenticated workspace</span>
      }
    >
      <PageHeader
        title="Help"
        description="Guidance on interpreting alerts, submitting corrections, and staying safe from smishing."
      />
      <EmptyState
        title="Managed help content not connected"
        description="Curated help articles targeted by user context require an authenticated content endpoint that has not shipped yet."
        action={
          <InfoBadge>Requires GET /help/articles on the backend</InfoBadge>
        }
      />
    </AppShell>
  );
}

export default HelpPage;
