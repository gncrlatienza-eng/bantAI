import { ForbiddenException } from '@nestjs/common';

import { AuthAudience } from '../auth/constants';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationScopeGuard } from './organization-scope.guard';

describe('OrganizationScopeGuard', () => {
  const prisma = {
    organizationMembership: { findUnique: jest.fn() },
  };
  const guard = new OrganizationScopeGuard(prisma as unknown as PrismaService);

  const contextFor = (
    role?: string,
    audience: AuthAudience = AuthAudience.CLIENT,
    hasActiveLicense = true,
  ) => {
    const request: {
      params: { organizationId: string };
      user: { userId: string; audience: AuthAudience };
      organizationMembership?: unknown;
    } = {
      params: { organizationId: 'org-1' },
      user: { userId: 'user-1', audience },
    };
    prisma.organizationMembership.findUnique.mockResolvedValue(
      role
        ? {
            role,
            organization: {
              isActive: true,
              licenses: hasActiveLicense ? [{ id: 'license-1' }] : [],
            },
          }
        : null,
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
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-1',
          },
        },
      }),
    );
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

  it('rejects a mobile token even when the user belongs to the organization', async () => {
    const { context } = contextFor('OWNER', AuthAudience.MOBILE);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an organization without an active license', async () => {
    const { context } = contextFor('OWNER', AuthAudience.CLIENT, false);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
