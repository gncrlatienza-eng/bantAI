import { ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { OrganizationScopeGuard } from './organization-scope.guard';

describe('OrganizationScopeGuard', () => {
  const prisma = {
    organizationMembership: { findUnique: jest.fn() },
  };
  const guard = new OrganizationScopeGuard(prisma as unknown as PrismaService);

  const contextFor = (role?: string) => {
    const request: {
      params: { organizationId: string };
      user: { userId: string };
      organizationMembership?: unknown;
    } = { params: { organizationId: 'org-1' }, user: { userId: 'user-1' } };
    prisma.organizationMembership.findUnique.mockResolvedValue(
      role ? { role, organization: { isActive: true } } : null,
    );
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as never,
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('allows an active Tier-2 member only for their requested organization', async () => {
    const { context, request } = contextFor('TIER_2');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: 'org-1', userId: 'user-1' },
      },
      select: { role: true, organization: { select: { isActive: true } } },
    });
    expect(request.organizationMembership).toEqual(
      expect.objectContaining({ role: 'TIER_2' }),
    );
  });

  it('rejects a user without membership', async () => {
    const { context } = contextFor();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
