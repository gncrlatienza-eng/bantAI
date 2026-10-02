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
  NavMessagesIcon,
  NavSystemIcon,
  NotificationsIcon,
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
      {
        label: 'Mobile sync',
        path: '/admin/mobile-sync',
        icon: <NavMessagesIcon />,
      },
      {
        label: 'Campaigns',
        path: '/admin/campaigns',
        icon: <NavCampaignsIcon />,
      },
      { label: 'Model', path: '/admin/model', icon: <NavModelIcon /> },
      { label: 'Reports', path: '/admin/reports', icon: <NavReportsIcon /> },
      {
        label: 'Sender reports',
        path: '/admin/sender-reports',
        icon: <NavReportsIcon />,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Access requests',
        path: '/admin/access-requests',
        icon: <NavUsersIcon />,
      },
      { label: 'Users', path: '/admin/users', icon: <NavUsersIcon /> },
      {
        label: 'Shield API',
        path: '/admin/shield-api',
        icon: <NavSystemIcon />,
      },
      { label: 'Audit events', path: '/admin/audit', icon: <NavSystemIcon /> },
      { label: 'Tips', path: '/admin/tips', icon: <NavReportsIcon /> },
      { label: 'Export', path: '/admin/export', icon: <NavReportsIcon /> },
      { label: 'System', path: '/admin/system', icon: <NavSystemIcon /> },
      {
        label: 'Notifications',
        path: '/admin/notifications',
        icon: <NotificationsIcon />,
      },
      { label: 'Settings', path: '/admin/settings', icon: <NavSystemIcon /> },
    ],
  },
];

// Keep visibility aligned with the API guards. Navigation is a usability gate;
// the backend still authorizes each request independently.
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/admin/overview': ['overview:read'],
  '/admin/campaigns': ['campaigns:manage'],
  '/admin/model': ['models:read'],
  '/admin/reports': ['reports:read'],
  '/admin/sender-reports': ['verification:read'],
  '/admin/export': ['*'],
  '/admin/system': ['system:read'],
  '/admin/access-requests': ['access_requests:manage'],
  '/admin/users': ['access_requests:manage'],
  '/admin/mobile-sync': ['*'],
  '/admin/shield-api': ['*'],
  '/admin/audit': ['*'],
  '/admin/tips': ['*'],
};
ADMIN_SIDEBAR_GROUPS.forEach((group) => {
  group.items.forEach((item) => {
    item.permissions = ROUTE_PERMISSIONS[item.path];
  });
});

export function getFilteredAdminSidebarGroups(
  permissions: string[],
): NavGroupDef[] {
  return ADMIN_SIDEBAR_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.permissions?.length ||
        permissions.includes('*') ||
        item.permissions.some((p) => permissions.includes(p)),
    ),
  })).filter((group) => group.items.length > 0);
}
