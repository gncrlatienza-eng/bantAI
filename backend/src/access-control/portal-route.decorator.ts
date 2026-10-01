import { SetMetadata } from '@nestjs/common';

import type { OrganizationEntitlement } from '../portal-organizations/entitlement-policy';
import type { MemberCapability } from './member-capabilities';

export const PORTAL_ROUTE_KEY = 'portal-route';

/**
 * Client-portal sessions are deny-by-default: a route is reachable with a
 * CLIENT-audience session only when it declares one of these rules. Mobile and
 * admin sessions are unaffected (admin routes keep AdminGuard).
 */
export type PortalRouteRule =
  | { kind: 'account' }
  | {
      kind: 'licensed';
      capability: MemberCapability;
      entitlement?: OrganizationEntitlement;
      // 'organization-param' binds the check to :organizationId instead of
      // any workspace the user belongs to.
      scope: 'any-workspace' | 'organization-param';
    };

/** Signed-in portal account routes that must work without a license. */
export const PortalAccount = () =>
  SetMetadata(PORTAL_ROUTE_KEY, { kind: 'account' } satisfies PortalRouteRule);

/** Routes that require an active license, entitlement, and capability. */
export const PortalLicensed = (rule: {
  capability: MemberCapability;
  entitlement?: OrganizationEntitlement;
  scope?: 'any-workspace' | 'organization-param';
}) =>
  SetMetadata(PORTAL_ROUTE_KEY, {
    kind: 'licensed',
    capability: rule.capability,
    entitlement: rule.entitlement,
    scope: rule.scope ?? 'any-workspace',
  } satisfies PortalRouteRule);
