/*
 * Shared Shield sidebar groups. Every external portal page must use
 * useClientSidebarGroups() so the portal shows the same navigation
 * everywhere.
 *
 * Visibility is a product boundary, while the backend remains responsible for
 * authorization. Shield intentionally has no raw message, dataset, model, or
 * administration entry points.
 */

import React from 'react';
import type {
  NavGroupDef,
  NavItemDef,
} from '../../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavReportsIcon,
  NavSystemIcon,
  NotificationsIcon,
} from '../../components/primitives';

const CLIENT_NAV: Array<Omit<NavGroupDef, 'items'> & { items: NavItemDef[] }> =
  [
    {
      label: 'Threat Intelligence',
      items: [
        {
          label: 'Overview',
          path: '/shield/overview',
          icon: <NavOverviewIcon />,
        },
        {
          label: 'Campaigns',
          path: '/shield/campaigns',
          icon: <NavCampaignsIcon />,
        },
      ],
    },
    {
      label: 'Access',
      items: [
        {
          label: 'API',
          path: '/shield/api',
          icon: <NavReportsIcon />,
        },
        {
          label: 'Exports',
          path: '/shield/exports',
          icon: <NavReportsIcon />,
        },
        {
          label: 'Notifications',
          path: '/shield/notifications',
          icon: <NotificationsIcon />,
        },
        {
          label: 'Documentation',
          path: '/shield/documentation',
          icon: <NavReportsIcon />,
        },
        {
          label: 'Account',
          path: '/account',
          icon: <NavSystemIcon />,
        },
      ],
    },
  ];

/** The deliberately narrow navigation for the external Shield portal. */
export function useClientSidebarGroups(): NavGroupDef[] {
  return CLIENT_NAV;
}
