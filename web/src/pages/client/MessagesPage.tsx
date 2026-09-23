/*
 * Client Messages page. Phase F step 5.
 *
 * Analyst inbox for alert-backed message records: list on the left, detail
 * panel on the right. Absorbs the legacy "Review classification" modal, so
 * indicator tags and correction submission are inline in the detail column.
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
import { MessagesInbox } from '../../features/messages/MessagesInbox';
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

export function MessagesPage() {
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
      topbarContext={<span>Threat Intelligence &middot; Messages</span>}
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
        title="Messages"
        description="Alert-backed classifications for messages received on your registered device. Raw SMS bodies stay on the phone; this portal shows only server-side metadata."
      />
      <MessagesInbox />
    </AppShell>
  );
}

export default MessagesPage;
