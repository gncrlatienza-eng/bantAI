import { SetMetadata } from '@nestjs/common';

import type { OrganizationEntitlement } from './entitlement-policy';

export const ORGANIZATION_ENTITLEMENT_KEY = 'organization-entitlement';

export const RequireOrganizationEntitlement = (
  entitlement: OrganizationEntitlement,
) => SetMetadata(ORGANIZATION_ENTITLEMENT_KEY, entitlement);
