/*
 * Shield sidebar groups, derived from the navigation registry
 * (src/navigation/portalNav.tsx).
 *
 * Visibility is a product boundary, while the backend remains responsible for
 * authorization. Shield intentionally has no raw message, dataset, model, or
 * administration entry points. Account and notifications live in the top bar.
 */

import type { NavGroupDef } from '../../components/appshell/AppShell';
import { SHIELD_NAV, toNavGroups } from '../../navigation/portalNav';

const CLIENT_NAV = toNavGroups(SHIELD_NAV, ['*']);

/** The deliberately narrow navigation for the external Shield portal. */
export function useClientSidebarGroups(): NavGroupDef[] {
  return CLIENT_NAV;
}
