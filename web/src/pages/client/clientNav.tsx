/*
 * Shared client sidebar groups.
 */

import React from 'react';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavAnalyticsIcon,
  NavReportsIcon,
  NavSystemIcon,
} from '../../components/primitives';

export const CLIENT_SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Threat Intelligence',
    items: [
      { label: 'Overview', path: '/client/overview', icon: <NavOverviewIcon /> },
      { label: 'Messages', path: '/client/messages', icon: <NavMessagesIcon /> },
      { label: 'Campaigns', path: '/client/campaigns', icon: <NavCampaignsIcon /> },
      { label: 'Analytics', path: '/client/analytics', icon: <NavAnalyticsIcon /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Help', path: '/client/help', icon: <NavReportsIcon /> },
      { label: 'Account settings', path: '/client/settings', icon: <NavSystemIcon /> },
    ],
  },
];
