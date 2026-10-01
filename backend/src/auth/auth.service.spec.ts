import {
  BadRequestException,
  ConflictException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { OtpSmsService } from './otp-sms.service';
import { PortalOtpEmailService } from './portal-otp-email.service';
import { AuthAudience } from './constants';

describe('AuthService', () => {
  const prisma = {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    accessRequest: { findUnique: jest.fn(), updateMany: jest.fn() },
    emailOtpChallenge: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationMembership: { upsert: jest.fn() },
    organizationInvitation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    portalOrganization: { update: jest.fn() },
    otpCode: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const sms = { send: jest.fn() };
  const email = { send: jest.fn() };
  const jwt = { signAsync: jest.fn() };
  let service: AuthService;
  const originalLegacyAuth = process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH;

  afterEach(() => {
    if (originalLegacyAuth === undefined)
      delete process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH;
    else process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = originalLegacyAuth;
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpSmsService, useValue: sms },
        { provide: PortalOtpEmailService, useValue: email },
        { provide: JwtService, useValue: jwt },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('does not persist an unverified registration profile', async () => {
    await expect(
      service.register({ phone: '0917 123 4567', firstName: 'A' }),
    ).resolves.toEqual({
      message: 'Verify this phone number before creating a profile.',
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('disables password-only session issuance unless explicitly enabled locally', async () => {
    delete process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH;
    await expect(
      service.login({ email: 'qa@example.com', password: 'test-password' }),
    ).rejects.toThrow(GoneException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('refuses password-only sessions in production even with the legacy flag', async () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = 'true';
      await expect(
        service.login({ email: 'qa@example.com', password: 'test-password' }),
      ).rejects.toThrow(GoneException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('rejects a sign-up OTP request when the email already belongs to an account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-existing' });

    await expect(
      service.requestSignUpOtp({ email: '  Existing@Example.com ' }),
    ).rejects.toThrow('An account already uses this email. Sign in instead.');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            email: { equals: 'existing@example.com', mode: 'insensitive' },
          },
          {
            mobileAuthEmail: {
              equals: 'existing@example.com',
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true },
    });
    expect(prisma.emailOtpChallenge.upsert).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('registers exactly one portal user from an active checkout', async () => {
    process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = 'true';
    prisma.accessRequest.findUnique.mockResolvedValue({
      id: 'ar-1',
      email: ' Client@Example.com ',
      organization: ' Example Co ',
      status: 'ACTIVE',
      activatedAt: new Date(),
      portalUserId: null,
    });
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u-web', role: 'USER', ...data }),
    );
    jwt.signAsync.mockResolvedValue('portal-jwt');

    await expect(
      service.registerPortal({
        checkoutSessionId: 'cs_test_active_checkout_123',
        password: 'strong-password',
      }),
    ).resolves.toMatchObject({ access_token: 'portal-jwt' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'client@example.com',
        company: 'Example Co',
        role: 'USER',
        webRole: 'SHIELD',
        passwordHash: expect.not.stringMatching(/^strong-password$/),
      }),
    });
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ portalUserId: null }),
        data: { portalUserId: 'u-web' },
      }),
    );
  });

  it('rejects portal registration until the checkout is active', async () => {
    process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = 'true';
    prisma.accessRequest.findUnique.mockResolvedValue({
      id: 'ar-1',
      status: 'PAYMENT_PENDING',
      activatedAt: null,
      portalUserId: null,
    });

    await expect(
      service.registerPortal({
        checkoutSessionId: 'cs_test_pending_checkout_123',
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a second account claim for the same license', async () => {
    process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = 'true';
    prisma.accessRequest.findUnique.mockResolvedValue({
      id: 'ar-1',
      email: 'client@example.com',
      organization: 'Example Co',
      status: 'ACTIVE',
      activatedAt: new Date(),
      portalUserId: 'u-existing',
    });

    await expect(
      service.registerPortal({
        checkoutSessionId: 'cs_test_claimed_checkout_123',
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('authenticates a portal user with email and password', async () => {
    process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH = 'true';
    jwt.signAsync.mockResolvedValue('portal-jwt');
    const passwordHash = await import('bcrypt').then((bcrypt) =>
      bcrypt.hash('strong-password', 12),
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-web',
      role: 'USER',
      webRole: 'SHIELD',
      passwordHash,
      portalAccessStatus: 'ACTIVE',
    });

    await expect(
      service.login({
        email: 'CLIENT@example.com',
        password: 'strong-password',
      }),
    ).resolves.toMatchObject({ access_token: 'portal-jwt' });

    await expect(
      service.login({
        email: 'client@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('atomically consumes a valid OTP and issues a role-bearing token', async () => {
    const phone = '+639171234567';
    const codeHash = (service as any).hashOtp(phone, '123456');
    prisma.otpCode.findUnique.mockResolvedValue({
      phone,
      codeHash,
      verified: false,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.upsert.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    jwt.signAsync.mockResolvedValue('jwt');
    await expect(
      service.verifyOtp({ phone: '09171234567', otp: '123456' }),
    ).resolves.toMatchObject({ access_token: 'jwt' });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ verified: false }),
      }),
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone } }),
    );
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: 'ADMIN' }),
    );
  });

  it('increments a bad OTP attempt before rejecting it', async () => {
    prisma.otpCode.findUnique.mockResolvedValue({
      phone: '+639171234567',
      codeHash: '00',
      verified: false,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    await expect(
      service.verifyOtp({ phone: '09171234567', otp: '111111' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
  });

  it('sends a web client OTP by email without changing mobile OTP storage', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-web', role: 'USER' });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);

    await expect(
      service.requestClientEmailOtp({ email: ' Client@Example.com ' }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });

    expect(prisma.emailOtpChallenge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: 'client@example.com',
          purpose: 'CLIENT_SIGN_IN',
        }),
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      'client@example.com',
      expect.stringMatching(/^\d{6}$/),
      'CLIENT_SIGN_IN',
    );
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('sends a purpose-bound mobile OTP for a new email identity', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);

    await expect(
      service.requestMobileEmailOtp({ email: ' Mobile@Example.com ' }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });

    expect(prisma.emailOtpChallenge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: 'mobile@example.com',
          purpose: 'MOBILE_SIGN_IN',
        }),
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      'mobile@example.com',
      expect.stringMatching(/^\d{6}$/),
      'MOBILE_SIGN_IN',
    );
  });

  it('does not send a mobile OTP to an address owned by a portal identity', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      role: 'ADMIN',
      webRole: 'ADMIN',
      passwordHash: null,
      accessRequests: [],
      organizationMemberships: [],
    });

    await expect(
      service.requestMobileEmailOtp({ email: 'staff@example.com' }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });
    expect(prisma.emailOtpChallenge.upsert).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('does not let an unverified profile email deny first-time mobile OTP', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      role: 'USER',
      webRole: null,
      passwordHash: null,
      accessRequests: [],
      organizationMemberships: [],
    });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);

    await service.requestMobileEmailOtp({ email: 'victim@example.com' });

    expect(email.send).toHaveBeenCalledWith(
      'victim@example.com',
      expect.stringMatching(/^\d{6}$/),
      'MOBILE_SIGN_IN',
    );
  });

  it('prefers a verified mobile identity over a colliding profile email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-mobile',
      role: 'USER',
      mobileAuthEmail: 'mobile@example.com',
      passwordHash: null,
      accessRequests: [],
      organizationMemberships: [],
    });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);

    await service.requestMobileEmailOtp({ email: 'mobile@example.com' });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mobileAuthEmail: 'mobile@example.com' },
      }),
    );
    expect(email.send).toHaveBeenCalled();
  });

  it('atomically consumes a mobile email OTP and issues a mobile token', async () => {
    const emailAddress = 'mobile@example.com';
    const codeHash = (service as any).hashEmailOtp(
      emailAddress,
      'MOBILE_SIGN_IN',
      '123456',
    );
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      challengeKey: 'challenge',
      codeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u-mobile', role: 'USER' });
    jwt.signAsync.mockResolvedValue('mobile-jwt');

    await expect(
      service.verifyMobileEmailOtp({ email: emailAddress, otp: '123456' }),
    ).resolves.toEqual({
      message: 'Authentication successful.',
      access_token: 'mobile-jwt',
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { mobileAuthEmail: emailAddress, role: 'USER' },
      select: { id: true, role: true },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'u-mobile',
      role: 'USER',
    });
  });

  it('allows verification when only an unverified profile email collides', async () => {
    const emailAddress = 'victim@example.com';
    const codeHash = (service as any).hashEmailOtp(
      emailAddress,
      'MOBILE_SIGN_IN',
      '123456',
    );
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      challengeKey: 'challenge',
      codeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      role: 'USER',
      passwordHash: null,
      accessRequests: [],
      organizationMemberships: [],
    });
    prisma.user.create.mockResolvedValue({ id: 'u-mobile', role: 'USER' });
    jwt.signAsync.mockResolvedValue('mobile-jwt');

    await expect(
      service.verifyMobileEmailOtp({ email: emailAddress, otp: '123456' }),
    ).resolves.toEqual({
      message: 'Authentication successful.',
      access_token: 'mobile-jwt',
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { mobileAuthEmail: emailAddress, role: 'USER' },
      select: { id: true, role: true },
    });
  });

  it('rejects a portal-purpose code on the mobile verification endpoint', async () => {
    const emailAddress = 'mobile@example.com';
    const portalCodeHash = (service as any).hashEmailOtp(
      emailAddress,
      'CLIENT_SIGN_IN',
      '123456',
    );
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      challengeKey: 'challenge',
      codeHash: portalCodeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.verifyMobileEmailOtp({ email: emailAddress, otp: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emailOtpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('silently suppresses excess email sends without revealing account eligibility', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-web', role: 'USER' });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      requestCount: 5,
      requestWindowStart: new Date(),
    });

    await expect(
      service.requestClientEmailOtp({ email: 'client@example.com' }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });
    expect(prisma.emailOtpChallenge.upsert).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('issues a client-domain token after consuming an email OTP once', async () => {
    const emailAddress = 'client@example.com';
    const codeHash = (service as any).hashEmailOtp(
      emailAddress,
      'CLIENT_SIGN_IN',
      '123456',
    );
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      challengeKey: 'challenge',
      codeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findFirst.mockResolvedValue({ id: 'u-web', role: 'USER' });
    jwt.signAsync.mockResolvedValue('client-jwt');

    await expect(
      service.verifyClientEmailOtp({ email: emailAddress, otp: '123456' }),
    ).resolves.toMatchObject({
      access_token: 'client-jwt',
      audience: AuthAudience.CLIENT,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ audience: AuthAudience.CLIENT }),
    );
  });

  it('lets a portal identity sign in without an active license (authentication ≠ license)', async () => {
    const emailAddress = 'expired@example.com';
    const bcrypt = await import('bcrypt');
    const account = {
      id: 'u-expired',
      email: emailAddress,
      role: 'USER',
      webRole: 'SHIELD',
      portalAccessStatus: 'ACTIVE',
      passwordHash: await bcrypt.hash('correct-password', 4),
    };
    prisma.user.findUnique.mockResolvedValue(account);
    prisma.user.findFirst.mockResolvedValue(account);
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);

    await service.requestPortalEmailOtp({
      email: emailAddress,
      password: 'correct-password',
    });

    expect(email.send).toHaveBeenCalledWith(
      emailAddress,
      expect.stringMatching(/^\d{6}$/),
      'CLIENT_SIGN_IN',
    );
    // The identity lookup must not require a membership or license.
    for (const [query] of prisma.user.findFirst.mock.calls) {
      expect(query.where).toEqual({
        email: emailAddress,
        webRole: 'SHIELD',
        portalAccessStatus: 'ACTIVE',
        passwordHash: { not: null },
      });
    }
  });

  it('still refuses web sign-in for suspended, revoked, or mobile-only accounts', async () => {
    const bcrypt = await import('bcrypt');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-suspended',
      email: 'suspended@example.com',
      role: 'USER',
      webRole: 'SHIELD',
      portalAccessStatus: 'SUSPENDED',
      passwordHash: await bcrypt.hash('correct-password', 4),
    });
    // findPortalIdentity filters on portalAccessStatus ACTIVE → no match.
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.requestPortalEmailOtp({
        email: 'suspended@example.com',
        password: 'correct-password',
      }),
    ).rejects.toThrow('This account does not have web portal access.');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sets an initial claim password and makes the account eligible for password-gated sign-in', async () => {
    const emailAddress = 'client@example.com';
    const checkoutSessionId = 'cs_test_paid_checkout_123';
    const codeHash = (service as any).hashEmailOtp(
      emailAddress,
      'CLIENT_CLAIM',
      '123456',
      checkoutSessionId,
    );
    const passwordlessUser = {
      id: 'u-web',
      email: emailAddress,
      role: 'USER',
      webRole: 'SHIELD',
      passwordHash: null,
      portalAccessStatus: 'ACTIVE',
    };
    prisma.accessRequest.findUnique.mockResolvedValue({
      id: 'ar-1',
      email: emailAddress,
      organization: 'Example Co',
      status: 'ACTIVE',
      activatedAt: new Date(),
      portalUserId: 'u-web',
      portalUser: passwordlessUser,
      license: {
        organizationId: 'org-1',
        status: 'ACTIVE',
        shieldApprovedAt: new Date(),
        shieldReviewDecision: 'APPROVED',
        validFrom: new Date(Date.now() - 60_000),
        validUntil: new Date(Date.now() + 60_000),
      },
    });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      accessRequestId: 'ar-1',
      codeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.organizationMembership.upsert.mockResolvedValue({});
    jwt.signAsync.mockResolvedValue('client-jwt');

    await expect(
      service.verifyClientClaimEmailOtp({
        email: emailAddress,
        checkoutSessionId,
        otp: '123456',
        password: 'a-new-password',
      }),
    ).resolves.toMatchObject({
      access_token: 'client-jwt',
      audience: AuthAudience.CLIENT,
    });

    const persistedHash = prisma.user.updateMany.mock.calls[0][0].data
      .passwordHash as string;
    expect(persistedHash).not.toBe('a-new-password');
    expect(
      await import('bcrypt').then((bcrypt) =>
        bcrypt.compare('a-new-password', persistedHash),
      ),
    ).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u-web',
        role: 'USER',
        portalAccessStatus: 'ACTIVE',
        passwordHash: null,
      },
      data: { passwordHash: persistedHash, webRole: 'SHIELD' },
    });
    expect(prisma.organizationMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'SHIELD', userId: 'u-web' }),
      }),
    );

    prisma.user.findUnique.mockResolvedValue({
      ...passwordlessUser,
      passwordHash: persistedHash,
    });
    prisma.user.findFirst.mockResolvedValue({
      ...passwordlessUser,
      passwordHash: persistedHash,
    });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue(null);
    email.send.mockResolvedValue(undefined);
    await expect(
      service.requestPortalEmailOtp({
        email: emailAddress,
        password: 'a-new-password',
      }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });
    expect(email.send).toHaveBeenCalledWith(
      emailAddress,
      expect.stringMatching(/^\d{6}$/),
      'CLIENT_SIGN_IN',
    );
  });

  it('never overwrites an existing password during a repeated claim', async () => {
    const emailAddress = 'client@example.com';
    const checkoutSessionId = 'cs_test_paid_checkout_123';
    const codeHash = (service as any).hashEmailOtp(
      emailAddress,
      'CLIENT_CLAIM',
      '123456',
      checkoutSessionId,
    );
    prisma.accessRequest.findUnique.mockResolvedValue({
      id: 'ar-1',
      email: emailAddress,
      organization: 'Example Co',
      status: 'ACTIVE',
      activatedAt: new Date(),
      portalUserId: 'u-web',
      portalUser: {
        id: 'u-web',
        email: emailAddress,
        role: 'USER',
        passwordHash: 'existing-hash',
        portalAccessStatus: 'ACTIVE',
      },
      license: {
        organizationId: 'org-1',
        status: 'ACTIVE',
        shieldApprovedAt: new Date(),
        shieldReviewDecision: 'APPROVED',
        validFrom: new Date(Date.now() - 60_000),
        validUntil: null,
      },
    });
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      accessRequestId: 'ar-1',
      codeHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.verifyClientClaimEmailOtp({
        email: emailAddress,
        checkoutSessionId,
        otp: '123456',
        password: 'replacement-password',
      }),
    ).rejects.toThrow('This account is already set up. Sign in instead.');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns the generic response for an unknown claim checkout session', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.requestClientClaimEmailOtp({
        email: 'client@example.com',
        checkoutSessionId: 'cs_test_unknown_checkout_123',
      }),
    ).resolves.toEqual({
      message: 'If the account is eligible, a verification code has been sent.',
    });
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong email', { email: 'other@example.com' }],
    ['unpaid checkout', { status: 'PAYMENT_PENDING', activatedAt: null }],
    [
      'legacy contract awaiting Shield review',
      { license: { shieldApprovedAt: null } },
    ],
    [
      'expired license',
      { license: { validUntil: new Date(Date.now() - 60_000) } },
    ],
    ['revoked account', { portalUser: { portalAccessStatus: 'REVOKED' } }],
    ['already-passworded account', { portalUser: { passwordHash: 'hash' } }],
    ['staff account', { portalUser: { role: 'ADMIN' } }],
  ])(
    'does not send a claim OTP for an ineligible %s',
    async (_name, override) => {
      const base = {
        id: 'ar-1',
        email: 'client@example.com',
        organization: 'Example Co',
        status: 'ACTIVE',
        activatedAt: new Date(),
        portalUserId: 'u-web',
        portalUser: {
          id: 'u-web',
          email: 'client@example.com',
          role: 'USER',
          passwordHash: null,
          portalAccessStatus: 'ACTIVE',
        },
        license: {
          organizationId: 'org-1',
          status: 'ACTIVE',
          shieldApprovedAt: new Date(),
          shieldReviewDecision: 'APPROVED',
          validFrom: new Date(Date.now() - 60_000),
          validUntil: null,
        },
      };
      prisma.accessRequest.findUnique.mockResolvedValue({
        ...base,
        ...override,
        license: { ...base.license, ...override.license },
        portalUser: { ...base.portalUser, ...override.portalUser },
      });

      await expect(
        service.requestClientClaimEmailOtp({
          email: 'client@example.com',
          checkoutSessionId: 'cs_test_paid_checkout_123',
        }),
      ).resolves.toEqual({
        message:
          'If the account is eligible, a verification code has been sent.',
      });
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.emailOtpChallenge.upsert).not.toHaveBeenCalled();
    },
  );
});
