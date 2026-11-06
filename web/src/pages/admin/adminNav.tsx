/*
 * Admin sidebar groups, derived from the navigation registry
 * (src/navigation/portalNav.tsx). Keep screens, tabs and their permissions
 * there; this file only shapes them for the AppShell sidebar.
 */

import type { NavGroupDef } from '../../components/appshell/AppShell';
import { ADMIN_NAV, toNavGroups } from '../../navigation/portalNav';

export function getFilteredAdminSidebarGroups(
  permissions: string[],
  badges: Partial<Record<string, number>> = {},
): NavGroupDef[] {
  return toNavGroups(ADMIN_NAV, permissions, badges);
}
