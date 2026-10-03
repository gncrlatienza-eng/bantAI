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
  NavApiKeysIcon,
  NavExportIcon,
  NavDocsIcon,
  NavAccountIcon,
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
          icon: <NavApiKeysIcon />,
        },
        {
          label: 'Exports',
          path: '/shield/exports',
          icon: <NavExportIcon />,
        },
        {
          label: 'Notifications',
          path: '/shield/notifications',
          icon: <NotificationsIcon />,
        },
        {
          label: 'Documentation',
          path: '/shield/documentation',
          icon: <NavDocsIcon />,
        },
        {
          label: 'Account',
          path: '/account',
          icon: <NavAccountIcon />,
        },
      ],
    },
  ];

/** The deliberately narrow navigation for the external Shield portal. */
export function useClientSidebarGroups(): NavGroupDef[] {
  return CLIENT_NAV;
}
