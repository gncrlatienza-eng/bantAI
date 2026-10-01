import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  entitlementPolicyFor,
  type OrganizationEntitlement,
} from './entitlement-policy';
import { ORGANIZATION_ENTITLEMENT_KEY } from './require-entitlement.decorator';

@Injectable()
export class LicenseEntitlementGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<OrganizationEntitlement>(
      ORGANIZATION_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      throw new ForbiddenException(
        'This organization route has no declared license entitlement.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      organizationAccess?: { tier?: 'SHIELD' };
    }>();
    const tier = request.organizationAccess?.tier;
    if (!tier) {
      throw new ForbiddenException('Active license context is required.');
    }
    const policy = entitlementPolicyFor(tier);
    if (!policy.features[required]) {
      throw new ForbiddenException(
        `The active ${policy.tier} license does not include ${required.toLowerCase()}.`,
      );
    }
    return true;
  }
}
