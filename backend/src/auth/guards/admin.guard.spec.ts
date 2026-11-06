import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from './admin.guard';
import { AuthAudience } from '../constants';

describe('AdminGuard', () => {
  function run(user: unknown, required?: string[]) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return new AdminGuard(reflector).canActivate(context);
  }

  const staff = (staffRole: string) => ({
    role: 'ADMIN',
    webRole: 'ADMIN',
    audience: AuthAudience.ADMIN,
    staffRole,
  });

  it('rejects a non-admin audience', () => {
    expect(() =>
      run({ webRole: 'ADMIN', audience: AuthAudience.CLIENT }),
    ).toThrow(ForbiddenException);
  });

  it('allows any admin staff when the route declares no permission', () => {
    expect(run(staff('PRIVACY'))).toBe(true);
  });

  it('enforces declared staff permissions like StaffGuard', () => {
    expect(run(staff('OPERATIONS'), ['system:read'])).toBe(true);
    expect(() => run(staff('SUPPORT'), ['system:read'])).toThrow(
      ForbiddenException,
    );
  });

  it('treats a "*" requirement as SUPERADMIN-only', () => {
    expect(run(staff('SUPERADMIN'), ['*'])).toBe(true);
    expect(() => run(staff('ANALYST'), ['*'])).toThrow(ForbiddenException);
  });
});
