import {
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PortalRoutePolicy } from '../../access-control/portal-route.policy';

/**
 * Authenticates the session, then applies the central portal route policy.
 * Client-portal sessions are deny-by-default; see PortalRoutePolicy.
 *
 * The policy is @Optional only so isolated controller unit tests can compile
 * without the access-control module. A running app always has it (the module
 * is global); if it is ever missing, every request fails closed.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() private readonly portalRoutes?: PortalRoutePolicy) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;
    if (!this.portalRoutes) {
      throw new InternalServerErrorException(
        'Route authorization policy is not configured.',
      );
    }
    await this.portalRoutes.enforce(context);
    return true;
  }
}
