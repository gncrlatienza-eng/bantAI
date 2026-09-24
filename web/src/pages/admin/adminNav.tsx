/*
 * Shared admin sidebar groups with least-privilege permission filtering.
 */

import React, { useEffect, useState } from 'react';
import type {
  NavGroupDef,
  NavItemDef,
} from '../../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavReportsIcon,
  NavModelIcon,
  NavSystemIcon,
} from '../../components/primitives';
import { getCurrentUser } from '../../services/authService';

export interface PermittedNavItemDef extends NavItemDef {
  permission?: string;
}

export interface PermittedNavGroupDef {
  label: string;
  items: PermittedNavItemDef[];
}

export const ALL_ADMIN_SIDEBAR_GROUPS: PermittedNavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Overview',
        path: '/admin/overview',
        icon: <NavOverviewIcon />,
        permission: 'overview:read',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Campaigns',
        path: '/admin/campaigns',
        icon: <NavCampaignsIcon />,
        permission: 'campaigns:read',
      },
      {
        label: 'Model',
        path: '/admin/model',
        icon: <NavModelIcon />,
        permission: 'models:read',
      },
      {
        label: 'Reports',
        path: '/admin/reports',
        icon: <NavReportsIcon />,
        permission: 'reports:read',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Tips',
        path: '/admin/tips',
        icon: <NavReportsIcon />,
        permission: 'verification:read',
      },
      {
        label: 'Export',
        path: '/admin/export',
        icon: <NavReportsIcon />,
        permission: 'privacy:read',
      },
      {
        label: 'System',
        path: '/admin/system',
        icon: <NavSystemIcon />,
        permission: 'system:read',
      },
      {
        label: 'Settings',
        path: '/admin/settings',
        icon: <NavSystemIcon />,
        permission: 'overview:read',
      },
    ],
  },
];

export function getFilteredAdminSidebarGroups(
  permissions: string[] = [],
): NavGroupDef[] {
  if (permissions.includes('*')) {
    return ALL_ADMIN_SIDEBAR_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.map(({ label, path, icon }) => ({ label, path, icon })),
    }));
  }

  return ALL_ADMIN_SIDEBAR_GROUPS.map((g) => {
    const items = g.items
      .filter(
        (item) => !item.permission || permissions.includes(item.permission),
      )
      .map(({ label, path, icon }) => ({ label, path, icon }));
    return {
      label: g.label,
      items,
    };
  }).filter((g) => g.items.length > 0);
}

export function useAdminNavGroups(): NavGroupDef[] {
  const [groups, setGroups] = useState<NavGroupDef[]>(() =>
    getFilteredAdminSidebarGroups(['*']),
  );

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((user) => {
        if (active && user?.permissions) {
          setGroups(getFilteredAdminSidebarGroups(user.permissions));
        }
      })
      .catch(() => {
        // Fallback
      });
    return () => {
      active = false;
    };
  }, []);

  return groups;
}

export const ADMIN_SIDEBAR_GROUPS: NavGroupDef[] = ALL_ADMIN_SIDEBAR_GROUPS.map(
  (g) => ({
    label: g.label,
    items: g.items.map(({ label, path, icon }) => ({ label, path, icon })),
  }),
);
