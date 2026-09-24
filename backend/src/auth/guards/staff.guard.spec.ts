import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffGuard } from './staff.guard';
import { resolveStaffPermissions } from '../constants/staff-permissions';

describe('StaffGuard', () => {
  let guard: StaffGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new StaffGuard(reflector);
  });

  function createMockContext(
    user: any,
    requiredPermissions?: string[],
  ): ExecutionContext {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredPermissions);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('rejects unauthenticated user or USER role', () => {
    const ctx = createMockContext({ role: 'USER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows legacy ADMIN with null staffRole (all permissions granted)', () => {
    const user = { role: 'ADMIN', staffRole: null, permissions: ['*'] };
    const ctx = createMockContext(user, ['reports:manage', 'models:deploy']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows SUPPORT staff to access reports:read and reports:manage', () => {
    const user = {
      role: 'ADMIN',
      staffRole: 'SUPPORT',
      permissions: resolveStaffPermissions('ADMIN', 'SUPPORT'),
    };
    const ctxRead = createMockContext(user, ['reports:read']);
    expect(guard.canActivate(ctxRead)).toBe(true);

    const ctxManage = createMockContext(user, ['reports:manage']);
    expect(guard.canActivate(ctxManage)).toBe(true);
  });

  it('rejects SUPPORT staff from accessing models:deploy or system:read', () => {
    const user = {
      role: 'ADMIN',
      staffRole: 'SUPPORT',
      permissions: resolveStaffPermissions('ADMIN', 'SUPPORT'),
    };
    const ctxDeploy = createMockContext(user, ['models:deploy']);
    expect(() => guard.canActivate(ctxDeploy)).toThrow(ForbiddenException);

    const ctxSystem = createMockContext(user, ['system:read']);
    expect(() => guard.canActivate(ctxSystem)).toThrow(ForbiddenException);
  });

  it('allows OPERATIONS staff to trigger retraining and deploy models, but blocks reports triage', () => {
    const user = {
      role: 'ADMIN',
      staffRole: 'OPERATIONS',
      permissions: resolveStaffPermissions('ADMIN', 'OPERATIONS'),
    };
    const ctxRetrain = createMockContext(user, ['retraining:trigger']);
    expect(guard.canActivate(ctxRetrain)).toBe(true);

    const ctxReport = createMockContext(user, ['reports:manage']);
    expect(() => guard.canActivate(ctxReport)).toThrow(ForbiddenException);
  });

  it('allows ANALYST staff to access campaigns and analytics, but blocks model deployment', () => {
    const user = {
      role: 'ADMIN',
      staffRole: 'ANALYST',
      permissions: resolveStaffPermissions('ADMIN', 'ANALYST'),
    };
    const ctxCampaign = createMockContext(user, ['campaigns:manage']);
    expect(guard.canActivate(ctxCampaign)).toBe(true);

    const ctxDeploy = createMockContext(user, ['models:deploy']);
    expect(() => guard.canActivate(ctxDeploy)).toThrow(ForbiddenException);
  });

  it('allows PRIVACY staff to access privacy:manage, but blocks analytics and models', () => {
    const user = {
      role: 'ADMIN',
      staffRole: 'PRIVACY',
      permissions: resolveStaffPermissions('ADMIN', 'PRIVACY'),
    };
    const ctxPrivacy = createMockContext(user, ['privacy:manage']);
    expect(guard.canActivate(ctxPrivacy)).toBe(true);

    const ctxModels = createMockContext(user, ['models:read']);
    expect(() => guard.canActivate(ctxModels)).toThrow(ForbiddenException);
  });
});
