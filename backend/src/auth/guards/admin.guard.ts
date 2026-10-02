import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthAudience } from '../constants';
import {
  resolveStaffPermissions,
  type StaffRole,
} from '../constants/staff-permissions';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

// Admin-audience session gate. Routes that also declare @RequirePermissions
// get the same staff-permission check as StaffGuard, so the server is at
// least as strict as the Admin portal's navigation (adminNav.tsx). Routes
// without a declaration stay open to every admin-audience staff member.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: {
        role?: string;
        webRole?: string | null;
        audience?: AuthAudience;
        staffRole?: StaffRole | null;
        permissions?: string[];
      };
    }>();
    const user = req.user;
    if (user?.webRole !== 'ADMIN' || user.audience !== AuthAudience.ADMIN) {
      throw new ForbiddenException('Administrator access is required.');
    }

    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const granted =
      user.permissions && user.permissions.length > 0
        ? user.permissions
        : resolveStaffPermissions(user.role ?? '', user.staffRole);
    if (granted.includes('*')) return true;
    if (!required.every((perm) => granted.includes(perm))) {
      throw new ForbiddenException(
        `Forbidden: Missing required staff permission (${required.join(', ')})`,
      );
    }
    return true;
  }
}
