/*
 * Admin Tips page — placeholder pending backend endpoint.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button, EmptyState, InfoBadge } from '../../components/primitives';
import { logout } from '../../services/authService';
import { useAdminNavGroups } from './adminNav';

export function TipsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navGroups = useAdminNavGroups();

  return (
    <AppShell
      role="admin"
      groups={navGroups}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Administration &middot; Tips</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/admin-login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Safety tips"
        description="Managed guidance shown to mobile clients about identifying smishing and staying safe."
      />
      <EmptyState
        title="Tips management not connected"
        description="Authoring safety tips, targeting them by region or campaign, and publishing them to mobile requires an authenticated endpoint."
        action={<InfoBadge>Requires CRUD /admin/tips on the backend</InfoBadge>}
      />
    </AppShell>
  );
}

export default TipsPage;
