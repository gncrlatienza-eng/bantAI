/*
 * Client Analytics page. Phase F step 6.
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
import { AnalyticsView } from '../../features/analytics/AnalyticsView';
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

export function AnalyticsPage() {
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
      topbarContext={<span>Threat Intelligence &middot; Analytics</span>}
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
        title="Analytics"
        description="Counts of classifications and alert lifecycle states across the messages the backend has processed for your account."
      />
      <AnalyticsView />
    </AppShell>
  );
}

export default AnalyticsPage;
