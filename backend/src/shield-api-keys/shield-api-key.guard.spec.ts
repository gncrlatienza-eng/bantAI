import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ShieldApiScope } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { ShieldApiKeyGuard } from './shield-api-key.guard';

describe('ShieldApiKeyGuard', () => {
  const prisma = {
    shieldApiKey: { findUnique: jest.fn(), update: jest.fn() },
    organizationMembership: { findUnique: jest.fn() },
    shieldApiRequest: { count: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((operation) => operation(prisma)),
  };
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new ShieldApiKeyGuard(
    prisma,
    reflector as unknown as Reflector,
  );
  const validSecret = `bnt_live_${'a'.repeat(43)}`;
  const context = (secret = validSecret) => {
    const request = { headers: { authorization: `Bearer ${secret}` } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => null,
      getClass: () => null,
    } as never;
  };
  const activeKey = () => ({
    id: 'key-1',
    organizationId: 'org-1',
    createdByUserId: 'user-1',
    scopes: [ShieldApiScope.READ_CAMPAIGNS],
    status: 'ACTIVE',
    expiresAt: null,
    createdBy: { webRole: 'SHIELD', portalAccessStatus: 'ACTIVE' },
    organization: {
      isActive: true,
      apiMonthlyQuota: 50_000,
      apiRateLimitPerMinute: 100,
      licenses: [{ id: 'license-1' }],
    },
  });

  beforeEach(() => {
    process.env.PORTAL_API_RELEASED = 'true';
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(ShieldApiScope.READ_CAMPAIGNS);
    prisma.shieldApiKey.findUnique.mockResolvedValue(activeKey());
    prisma.shieldApiKey.update.mockResolvedValue({ id: 'key-1' });
    prisma.organizationMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
    });
    prisma.shieldApiRequest.count.mockResolvedValue(0);
    prisma.shieldApiRequest.create.mockResolvedValue({ id: 'request-1' });
  });
  afterEach(() => {
    delete process.env.PORTAL_API_RELEASED;
  });

  it('accepts a scoped active Shield key without returning the secret', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(prisma.shieldApiKey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ secretHash: true }),
      }),
    );
  });

  it.each([
    ['revoked', { status: 'REVOKED' }],
    ['expired', { expiresAt: new Date('2020-01-01') }],
    [
      'suspended creator',
      { createdBy: { webRole: 'SHIELD', portalAccessStatus: 'SUSPENDED' } },
    ],
    ['unlicensed tenant', { organization: { isActive: true, licenses: [] } }],
  ])('rejects a %s key', async (_label, patch) => {
    prisma.shieldApiKey.findUnique.mockResolvedValue({
      ...activeKey(),
      ...patch,
    });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.shieldApiKey.update).not.toHaveBeenCalled();
  });

  it('denies an undeclared scope', async () => {
    reflector.getAllAndOverride.mockReturnValue(
      ShieldApiScope.EXPORT_CAMPAIGNS,
    );
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a key after its creator leaves the Shield organization', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.shieldApiKey.update).not.toHaveBeenCalled();
  });

  it('enforces the per-key rate limit before recording usage', async () => {
    prisma.shieldApiRequest.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);
    await expect(guard.canActivate(context())).rejects.toMatchObject({
      status: 429,
    });
    expect(prisma.shieldApiRequest.create).not.toHaveBeenCalled();
  });

  it('rejects malformed credentials before querying the database', async () => {
    await expect(guard.canActivate(context('bad-key'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.shieldApiKey.findUnique).not.toHaveBeenCalled();
  });

  it('rejects existing keys when Shield API access is disabled', async () => {
    process.env.PORTAL_API_RELEASED = 'false';
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.shieldApiKey.findUnique).not.toHaveBeenCalled();
  });

  it('answers 403, not 401, to a keyless request while the API is unreleased', async () => {
    // Matches the documented precedence in SHIELD_API_ERRORS.
    process.env.PORTAL_API_RELEASED = 'false';
    const keyless = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => null,
      getClass: () => null,
    } as never;
    await expect(guard.canActivate(keyless)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
