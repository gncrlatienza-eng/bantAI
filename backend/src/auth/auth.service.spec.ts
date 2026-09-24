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

describe('AuthService', () => {
  const prisma = {
    user: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    otpCode: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationInvitation: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    organizationMembership: {
      upsert: jest.fn(),
    },
    portalOrganization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const sms = { send: jest.fn() };
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

  it('registers a portal user with a hashed password and issues a token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u-web', role: 'USER', ...data }),
    );
    jwt.signAsync.mockResolvedValue('portal-jwt');

    await expect(
      service.registerPortal({
        email: ' Client@Example.com ',
        password: 'strong-password',
        company: ' Example Co ',
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
  });

  it('rejects duplicate portal registration', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.registerPortal({
        email: 'client@example.com',
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('authenticates a portal user with email and password', async () => {
    const registration = service.registerPortal({
      email: 'client@example.com',
      password: 'strong-password',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u-web', role: 'USER', ...data }),
    );
    jwt.signAsync.mockResolvedValue('portal-jwt');
    await registration;
    const created = prisma.user.create.mock.calls[0][0].data;
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-web',
      role: 'USER',
      passwordHash: created.passwordHash,
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
});
