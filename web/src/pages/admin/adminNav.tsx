/*
 * Shared admin sidebar groups. Keeps every admin page pointing at the same
 * set of routes so a rename in one spot updates all of them. Icons are
 * semantic (from the icon abstraction layer), never Phosphor directly.
 */

import React from 'react';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavReportsIcon,
  NavUsersIcon,
  NavModelIcon,
  NavSystemIcon,
} from '../../components/primitives';

export const ADMIN_SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Overview', path: '/admin/overview', icon: <NavOverviewIcon /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Campaigns', path: '/admin/campaigns', icon: <NavCampaignsIcon /> },
      { label: 'Model', path: '/admin/model', icon: <NavModelIcon /> },
      { label: 'Reports', path: '/admin/reports', icon: <NavReportsIcon /> },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: <NavUsersIcon /> },
      { label: 'Tips', path: '/admin/tips', icon: <NavReportsIcon /> },
      { label: 'Export', path: '/admin/export', icon: <NavReportsIcon /> },
      { label: 'System', path: '/admin/system', icon: <NavSystemIcon /> },
      { label: 'Settings', path: '/admin/settings', icon: <NavSystemIcon /> },
    ],
  },
];
