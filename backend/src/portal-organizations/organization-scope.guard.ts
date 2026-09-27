import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AuthAudience } from '../auth/constants';

@Injectable()
export class OrganizationScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { organizationId?: string };
      user?: { userId?: string; audience?: AuthAudience };
      organizationMembership?: { role: 'OWNER' | 'TIER_1' | 'TIER_2' };
    }>();
    const organizationId = request.params.organizationId;
    const userId = request.user?.userId;
    if (
      !organizationId ||
      !userId ||
      request.user?.audience !== AuthAudience.CLIENT
    ) {
      throw new ForbiddenException('Organization-scoped access is required.');
    }
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        role: true,
        organization: {
          select: {
            isActive: true,
            licenses: {
              where: {
                status: 'ACTIVE',
                OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (
      !membership?.organization.isActive ||
      membership.organization.licenses.length === 0
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
    request.organizationMembership = membership;
    return true;
  }
}
