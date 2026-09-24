import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
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
    },
    accessRequest: { findUnique: jest.fn(), updateMany: jest.fn() },
    emailOtpChallenge: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationMembership: { upsert: jest.fn() },
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

  it('registers exactly one portal user from an active checkout', async () => {
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
    jwt.signAsync.mockResolvedValue('portal-jwt');
    const passwordHash = await import('bcrypt').then((bcrypt) =>
      bcrypt.hash('strong-password', 12),
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-web',
      role: 'USER',
      passwordHash,
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
});
