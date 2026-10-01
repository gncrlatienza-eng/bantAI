/*
 * Client Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the client AppShell. Admin uses the
 * same list with a different shell; both share sort, filter, search logic.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button } from '../../components/primitives';
import { CampaignsList } from '../../features/campaigns/CampaignsList';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';

export function CampaignsPage() {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Shield &middot; Campaigns</span>}
      topbarUtility={
        <>
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
        </>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>
          Shield intelligence subscription
        </span>
      }
    >
      <PageHeader
        title="Campaigns"
        description="Browse published smishing campaign intelligence, indicators, and status changes."
      />
      <CampaignsList
        role="client"
        onCampaignClick={(c) =>
          void navigate(`/shield/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </AppShell>
  );
}

export default CampaignsPage;
