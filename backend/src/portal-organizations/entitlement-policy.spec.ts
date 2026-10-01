import { AccessRequestTier } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { entitlementPolicyFor } from './entitlement-policy';
import { LicenseEntitlementGuard } from './license-entitlement.guard';

describe('Shield subscription entitlements', () => {
  const originalApiRelease = process.env.PORTAL_API_RELEASED;

  afterEach(() => {
    if (originalApiRelease === undefined)
      delete process.env.PORTAL_API_RELEASED;
    else process.env.PORTAL_API_RELEASED = originalApiRelease;
  });

  it('denies dataset, bulk download, and redistribution access', () => {
    const policy = entitlementPolicyFor(AccessRequestTier.SHIELD);
    expect(policy.features.MASKED_DATASET).toBe(false);
    expect(policy.features.HISTORICAL_DATASET).toBe(false);
    expect(policy.features.BULK_DOWNLOAD).toBe(false);
    expect(policy.features.API_ACCESS).toBe(false);
    expect(policy.features.REDISTRIBUTION).toBe(false);
    expect(policy.limits.maximumMembers).toBeGreaterThan(0);
    expect(policy.limits.maximumExportRowsPerRequest).toBeGreaterThan(0);
    expect(policy.freshnessDelayMinutes).toBe(0);
  });

  it('allows Shield API access only after an explicit release flag', () => {
    delete process.env.PORTAL_API_RELEASED;
    expect(
      entitlementPolicyFor(AccessRequestTier.SHIELD).features.API_ACCESS,
    ).toBe(false);
    process.env.PORTAL_API_RELEASED = 'true';
    expect(
      entitlementPolicyFor(AccessRequestTier.SHIELD).features.API_ACCESS,
    ).toBe(true);
  });

  it('guard denies a Shield subscription requesting raw dataset access', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('MASKED_DATASET'),
    } as unknown as Reflector;
    const guard = new LicenseEntitlementGuard(reflector);
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ organizationAccess: { tier: 'SHIELD' } }),
      }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('guard denies direct access without tenant/license context', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('DATA_EXPORT'),
    } as unknown as Reflector;
    const guard = new LicenseEntitlementGuard(reflector);
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
