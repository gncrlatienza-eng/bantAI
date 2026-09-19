import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { organizationId?: string };
      user?: { userId?: string };
      organizationMembership?: { role: 'TIER_1' | 'TIER_2' };
    }>();
    const organizationId = request.params.organizationId;
    const userId = request.user?.userId;
    if (!organizationId || !userId) {
      throw new ForbiddenException('Organization-scoped access is required.');
    }
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true, organization: { select: { isActive: true } } },
    });
    if (!membership?.organization.isActive) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
    request.organizationMembership = membership;
    return true;
  }
}
