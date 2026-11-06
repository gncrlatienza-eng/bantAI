import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthAudience } from '../auth/constants';
import {
  PORTAL_ROUTE_KEY,
  type PortalRouteRule,
} from './portal-route.decorator';
import {
  accessPermits,
  WorkspaceAccessService,
  type WorkspaceAccess,
} from './workspace-access.service';

export type PortalDenialCode =
  | 'PORTAL_ROUTE_NOT_ALLOWED'
  | 'LICENSE_INACTIVE'
  | 'WORKSPACE_ACCESS_DENIED'
  | 'ENTITLEMENT_MISSING'
  | 'CAPABILITY_DENIED';

function deny(code: PortalDenialCode, message: string): never {
  throw new ForbiddenException({ statusCode: 403, code, message });
}

/**
 * Central authorization for client-portal sessions, run by JwtAuthGuard after
 * authentication. authenticated ≠ licensed: account routes need only a valid
 * session; licensed routes re-check membership, license status, validity
 * window, license entitlement, and member capability on every request.
 */
@Injectable()
export class PortalRoutePolicy {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async enforce(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<{
      user?: {
        userId?: string;
        audience?: AuthAudience;
        webRole?: string | null;
      };
      params?: Record<string, string | undefined>;
      workspaceAccess?: WorkspaceAccess;
    }>();
    const user = request.user;
    if (!user?.userId) {
      throw new UnauthorizedException('Authentication is required.');
    }
    if (user.audience !== AuthAudience.CLIENT) return;
    if (user.webRole !== 'SHIELD') {
      deny('PORTAL_ROUTE_NOT_ALLOWED', 'Shield access is required.');
    }

    const rule = this.reflector.getAllAndOverride<PortalRouteRule | undefined>(
      PORTAL_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rule) {
      deny(
        'PORTAL_ROUTE_NOT_ALLOWED',
        'This route is not available to portal accounts.',
      );
    }
    if (rule.kind === 'account') return;

    const organizationId =
      rule.scope === 'organization-param'
        ? request.params?.organizationId
        : undefined;
    if (rule.scope === 'organization-param' && !organizationId) {
      deny('WORKSPACE_ACCESS_DENIED', 'An organization is required.');
    }

    const accesses = await this.workspaceAccess.activeAccessFor(
      user.userId,
      organizationId,
    );
    if (accesses.length === 0) {
      if (organizationId) {
        deny(
          'WORKSPACE_ACCESS_DENIED',
          'You do not have access to this organization.',
        );
      }
      deny('LICENSE_INACTIVE', 'An active BantAI license is required.');
    }

    const permitted = accesses.find((access) =>
      accessPermits(access, rule.capability, rule.entitlement),
    );
    if (!permitted) {
      const entitled = accesses.some(
        (access) =>
          !rule.entitlement || access.policy.features[rule.entitlement],
      );
      if (!entitled) {
        deny(
          'ENTITLEMENT_MISSING',
          'Your license does not include this feature.',
        );
      }
      deny('CAPABILITY_DENIED', 'Shield does not permit this action.');
    }
    request.workspaceAccess = permitted;
  }
}
