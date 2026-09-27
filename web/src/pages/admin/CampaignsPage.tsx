/*
 * Admin Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the admin AppShell. Admin gets an extra
 * "Deactivate" action per row via role="admin" prop on the list.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button } from '../../components/primitives';
import { CampaignsList } from '../../features/campaigns/CampaignsList';
import { logout } from '../../services/authService';
import { useAdminNavGroups } from './adminNav';

export function CampaignsPage() {
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
      topbarContext={<span>Intelligence &middot; Campaigns</span>}
      topbarUtility={
        <>
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
        </>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Campaigns"
        description="All detected campaign clusters across every client organization. Deactivate a campaign to stop clustering new messages under it."
      />
      <CampaignsList
        role="admin"
        onCampaignClick={(c) =>
          void navigate(`/admin/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </AppShell>
  );
}

export default CampaignsPage;
