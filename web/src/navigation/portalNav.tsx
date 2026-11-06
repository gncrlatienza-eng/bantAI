/*
 * One registry for signed-in navigation (docs/redesign/phase-b-post-auth-navigation-plan.md).
 *
 * Sidebar items, hub tabs, breadcrumbs and the permission each screen needs
 * all come from here, so a screen can't be gated one way in the sidebar and
 * another way in its tabs. Navigation is a usability gate only: every API
 * still authorizes the request on its own.
 */

import React from 'react';
import type { NavGroupDef } from '../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavModelIcon,
  NavFlaggedMessagesIcon,
  NavAccessRequestsIcon,
  NavTipsIcon,
  NavInfrastructureIcon,
  NavApiKeysIcon,
  NavDocsIcon,
} from '../components/primitives';

export interface PortalTab {
  id: string;
  label: string;
  path: string;
  /** Any one of these grants the tab; '*' holders see everything. */
  permissions?: string[];
}

export interface PortalSection {
  id: string;
  label: string;
  /** Base path. Hubs redirect it to their first visible tab. */
  path: string;
  icon?: React.ReactNode;
  /** Ignored for hubs: a hub is visible when any of its tabs is. */
  permissions?: string[];
  tabs?: PortalTab[];
  /** Label for a child page under the section (e.g. a campaign). */
  detailLabel?: string;
}

export interface PortalGroup {
  label?: string;
  placement?: 'bottom';
  sections: PortalSection[];
}

export interface BreadcrumbPart {
  label: string;
  path?: string;
}

/* ------------------------------------------------------------------ */
/*  Admin                                                             */
/* ------------------------------------------------------------------ */

export const ADMIN_NAV: PortalGroup[] = [
  {
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        path: '/admin/overview',
        icon: <NavOverviewIcon />,
        permissions: ['overview:read'],
      },
      {
        id: 'review',
        label: 'Review',
        path: '/admin/review',
        icon: <NavFlaggedMessagesIcon />,
        tabs: [
          {
            id: 'reports',
            label: 'Message reports',
            path: '/admin/review/reports',
            permissions: ['reports:read'],
          },
          {
            id: 'senders',
            label: 'Sender reports',
            path: '/admin/review/senders',
            permissions: ['verification:read'],
          },
          {
            id: 'detections',
            label: 'Detections',
            path: '/admin/review/detections',
            permissions: ['models:read'],
          },
        ],
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        path: '/admin/campaigns',
        icon: <NavCampaignsIcon />,
        permissions: ['campaigns:manage'],
        detailLabel: 'Campaign',
      },
      {
        id: 'messages',
        label: 'Messages',
        path: '/admin/messages',
        icon: <NavMessagesIcon />,
        permissions: ['*'],
      },
      {
        id: 'model',
        label: 'Model',
        path: '/admin/model',
        icon: <NavModelIcon />,
        tabs: [
          {
            id: 'overview',
            label: 'Overview',
            path: '/admin/model/overview',
            permissions: ['models:read'],
          },
          {
            id: 'drift',
            label: 'Drift',
            path: '/admin/model/drift',
            permissions: ['models:read'],
          },
          {
            id: 'dataset',
            label: 'Dataset',
            path: '/admin/model/dataset',
            permissions: ['models:read'],
          },
          {
            id: 'errors',
            label: 'Errors',
            path: '/admin/model/errors',
            permissions: ['models:read'],
          },
        ],
      },
    ],
  },
  {
    label: 'Manage',
    sections: [
      {
        id: 'customers',
        label: 'Customers',
        path: '/admin/customers',
        icon: <NavAccessRequestsIcon />,
        tabs: [
          {
            id: 'requests',
            label: 'Requests',
            path: '/admin/customers/requests',
            permissions: ['access_requests:manage'],
          },
          {
            id: 'accounts',
            label: 'Accounts',
            path: '/admin/customers/accounts',
            permissions: ['access_requests:manage'],
          },
          {
            id: 'api',
            label: 'API usage',
            path: '/admin/customers/api',
            permissions: ['*'],
          },
        ],
      },
      {
        id: 'tips',
        label: 'Tips',
        path: '/admin/tips',
        icon: <NavTipsIcon />,
        permissions: ['*'],
      },
      {
        id: 'system',
        label: 'System',
        path: '/admin/system',
        icon: <NavInfrastructureIcon />,
        tabs: [
          {
            id: 'health',
            label: 'Health',
            path: '/admin/system/health',
            permissions: ['system:read'],
          },
          {
            id: 'logs',
            label: 'API logs',
            path: '/admin/system/logs',
            permissions: ['system:read'],
          },
          {
            id: 'storage',
            label: 'Storage',
            path: '/admin/system/storage',
            permissions: ['system:read'],
          },
          {
            id: 'audit',
            label: 'Audit',
            path: '/admin/system/audit',
            permissions: ['*'],
          },
          {
            id: 'exports',
            label: 'Exports',
            path: '/admin/system/exports',
            permissions: ['*'],
          },
        ],
      },
    ],
  },
];

/** Reached from the top bar (avatar menu, bell), never the sidebar. */
export const ADMIN_UTILITY: PortalSection[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    tabs: [
      { id: 'profile', label: 'Profile', path: '/admin/settings/profile' },
      {
        id: 'notifications',
        label: 'Notifications',
        path: '/admin/settings/notifications',
      },
    ],
  },
  { id: 'inbox', label: 'Notifications', path: '/admin/notifications' },
];

/* ------------------------------------------------------------------ */
/*  Shield                                                            */
/* ------------------------------------------------------------------ */

export const SHIELD_NAV: PortalGroup[] = [
  {
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        path: '/shield/overview',
        icon: <NavOverviewIcon />,
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        path: '/shield/campaigns',
        icon: <NavCampaignsIcon />,
        detailLabel: 'Campaign',
      },
      {
        id: 'api',
        label: 'API',
        path: '/shield/api',
        icon: <NavApiKeysIcon />,
      },
    ],
  },
  {
    placement: 'bottom',
    sections: [
      {
        id: 'documentation',
        label: 'Documentation',
        path: '/shield/documentation',
        icon: <NavDocsIcon />,
      },
    ],
  },
];

export const SHIELD_UTILITY: PortalSection[] = [
  { id: 'account', label: 'Account', path: '/shield/account' },
  {
    id: 'notifications',
    label: 'Notifications',
    path: '/shield/notifications',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function hasPermission(
  granted: string[],
  required: string[] | undefined,
): boolean {
  if (!required?.length) return true;
  if (granted.includes('*')) return true;
  return required.some((p) => p !== '*' && granted.includes(p));
}

export function visibleTabs(
  section: PortalSection,
  granted: string[],
): PortalTab[] {
  return (section.tabs ?? []).filter((t) =>
    hasPermission(granted, t.permissions),
  );
}

export function sectionVisible(
  section: PortalSection,
  granted: string[],
): boolean {
  if (section.tabs?.length) return visibleTabs(section, granted).length > 0;
  return hasPermission(granted, section.permissions);
}

function underPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + '/');
}

function allSections(
  groups: PortalGroup[],
  utility: PortalSection[],
): PortalSection[] {
  return [...groups.flatMap((g) => g.sections), ...utility];
}

export function findSection(
  groups: PortalGroup[],
  utility: PortalSection[],
  pathname: string,
): PortalSection | undefined {
  return allSections(groups, utility).find((s) => underPath(pathname, s.path));
}

/** Whether `granted` may open `pathname`. Unknown paths are left alone. */
export function pathPermitted(
  groups: PortalGroup[],
  utility: PortalSection[],
  pathname: string,
  granted: string[],
): boolean {
  const section = findSection(groups, utility, pathname);
  if (!section) return true;
  const tab = section.tabs?.find((t) => underPath(pathname, t.path));
  if (tab) return hasPermission(granted, tab.permissions);
  return sectionVisible(section, granted);
}

/** First screen the person can use: the landing after sign-in. */
export function firstPermittedPath(
  groups: PortalGroup[],
  utility: PortalSection[],
  granted: string[],
): string {
  for (const section of allSections(groups, utility)) {
    if (!sectionVisible(section, granted)) continue;
    return section.tabs?.length
      ? visibleTabs(section, granted)[0].path
      : section.path;
  }
  return utility[0]?.path ?? '/';
}

/** Section, then tab or child page — the top-bar breadcrumb. */
export function breadcrumbFor(
  groups: PortalGroup[],
  utility: PortalSection[],
  pathname: string,
): BreadcrumbPart[] {
  const section = findSection(groups, utility, pathname);
  if (!section) return [];
  const trail: BreadcrumbPart[] = [
    { label: section.label, path: section.path },
  ];
  const tab = section.tabs?.find((t) => underPath(pathname, t.path));
  if (tab) trail.push({ label: tab.label });
  else if (pathname !== section.path && section.detailLabel)
    trail.push({ label: section.detailLabel });
  if (trail.length === 1) delete trail[0].path;
  return trail;
}

/** Registry groups → AppShell sidebar groups for one account. */
export function toNavGroups(
  groups: PortalGroup[],
  granted: string[],
  badges: Partial<Record<string, number>> = {},
): NavGroupDef[] {
  return groups
    .map((group) => ({
      label: group.label,
      placement: group.placement,
      items: group.sections
        .filter((section) => sectionVisible(section, granted))
        .map((section) => ({
          label: section.label,
          path: section.path,
          icon: section.icon,
          badge: badges[section.id],
        })),
    }))
    .filter((group) => group.items.length > 0);
}

export const ADMIN_LANDING_FALLBACK = '/admin/settings/profile';

export function adminPathPermitted(pathname: string, granted: string[]) {
  return pathPermitted(ADMIN_NAV, ADMIN_UTILITY, pathname, granted);
}

export function firstPermittedAdminPath(granted: string[]): string {
  const path = firstPermittedPath(ADMIN_NAV, [], granted);
  return path === '/' ? ADMIN_LANDING_FALLBACK : path;
}
