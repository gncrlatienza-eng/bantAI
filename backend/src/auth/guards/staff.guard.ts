import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import {
  resolveStaffPermissions,
  type StaffRole,
} from '../constants/staff-permissions';

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<{
      user?: {
        role?: string;
        staffRole?: StaffRole | null;
        permissions?: string[];
      };
    }>();

    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Administrator access is required.');
    }

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userPermissions: string[] =
      user.permissions && user.permissions.length > 0
        ? user.permissions
        : resolveStaffPermissions(user.role, user.staffRole);

    if (userPermissions.includes('*')) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Forbidden: Missing required staff permission (${requiredPermissions.join(', ')})`,
      );
    }

    return true;
  }
}
