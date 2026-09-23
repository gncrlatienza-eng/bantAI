/*
 * Client Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the client AppShell. Admin uses the
 * same list with a different shell; both share sort, filter, search logic.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  Button,
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavAnalyticsIcon,
  NavReportsIcon,
  NavSystemIcon,
} from '../../components/primitives';
import { CampaignsList } from '../../features/campaigns/CampaignsList';
import { logout } from '../../services/authService';

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Threat Intelligence',
    items: [
      {
        label: 'Overview',
        path: '/client/overview',
        icon: <NavOverviewIcon />,
      },
      {
        label: 'Messages',
        path: '/client/messages',
        icon: <NavMessagesIcon />,
      },
      {
        label: 'Campaigns',
        path: '/client/campaigns',
        icon: <NavCampaignsIcon />,
      },
      {
        label: 'Analytics',
        path: '/client/analytics',
        icon: <NavAnalyticsIcon />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Help', path: '/client/help', icon: <NavReportsIcon /> },
      {
        label: 'Account settings',
        path: '/client/settings',
        icon: <NavSystemIcon />,
      },
    ],
  },
];

export function CampaignsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <AppShell
      role="client"
      groups={SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Threat Intelligence &middot; Campaigns</span>}
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
        <span style={{ fontSize: '0.85rem' }}>Authenticated account</span>
      }
    >
      <PageHeader
        title="Campaigns"
        description="Monitor related smishing activity and campaign evolution across your subscribers."
      />
      <CampaignsList
        role="client"
        onCampaignClick={(c) =>
          void navigate(`/client/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </AppShell>
  );
}

export default CampaignsPage;
