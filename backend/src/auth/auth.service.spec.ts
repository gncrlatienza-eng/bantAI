import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { OtpSmsService } from './otp-sms.service';
import { OtpEmailService } from './otp-email.service';

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
        { provide: OtpEmailService, useValue: email },
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

  it('requires MFA and does not issue an access token when an ADMIN logs in with password', async () => {
    const passwordHash = await bcrypt.hash('staff-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'staff@bantai.ph',
      role: 'ADMIN',
      passwordHash,
    });

    const res = await service.login({
      email: 'staff@bantai.ph',
      password: 'staff-password',
    });

    expect(res).toEqual({
      message: 'MFA verification required.',
      requiresMfa: true,
      email: 'staff@bantai.ph',
    });
    expect(res).not.toHaveProperty('access_token');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('fails closed and invalidates the code if OTP delivery fails', async () => {
    const phone = '+639171234567';
    prisma.otpCode.findUnique.mockResolvedValue(null);
    prisma.otpCode.upsert.mockResolvedValue({});
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    sms.send.mockRejectedValue(new Error('SMS Gateway Down'));

    await expect(service.requestOtp({ phone: '09171234567' })).rejects.toThrow(
      'OTP delivery is temporarily unavailable.',
    );

    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone, verified: false }),
        data: { verified: true },
      }),
    );
  });

  it('dispatches staff MFA OTP via email and not SMS when requested with an email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@bantai.ph',
      role: 'ADMIN',
    });
    prisma.otpCode.findUnique.mockResolvedValue(null);
    prisma.otpCode.upsert.mockResolvedValue({});
    email.send.mockResolvedValue(undefined);

    const res = await service.requestOtp({ email: 'staff@bantai.ph' });

    expect(res).toEqual({ message: 'OTP generated successfully.' });
    expect(email.send).toHaveBeenCalledWith(
      'staff@bantai.ph',
      expect.any(String),
    );
    expect(sms.send).not.toHaveBeenCalled();
    expect(prisma.otpCode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'staff@bantai.ph' },
      }),
    );
  });

  it('rejects staff email MFA request for non-admin accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      role: 'USER',
    });

    await expect(
      service.requestOtp({ email: 'customer@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(email.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('fails closed and invalidates email OTP code if email delivery fails', async () => {
    const staffEmail = 'staff@bantai.ph';
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      email: staffEmail,
      role: 'ADMIN',
    });
    prisma.otpCode.findUnique.mockResolvedValue(null);
    prisma.otpCode.upsert.mockResolvedValue({});
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    email.send.mockRejectedValue(new Error('SMTP failure'));

    await expect(service.requestOtp({ email: staffEmail })).rejects.toThrow(
      'OTP delivery is temporarily unavailable.',
    );

    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: staffEmail, verified: false }),
        data: { verified: true },
      }),
    );
  });

  it('verifies a valid email OTP and issues a privileged staff token', async () => {
    const staffEmail = 'staff@bantai.ph';
    const codeHash = (service as any).hashOtp(staffEmail, '654321');
    prisma.otpCode.findUnique.mockResolvedValue({
      email: staffEmail,
      codeHash,
      verified: false,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      email: staffEmail,
      role: 'ADMIN',
      staffRole: 'SUPERADMIN',
    });
    jwt.signAsync.mockResolvedValue('verified-staff-jwt');

    const res = await service.verifyOtp({ email: staffEmail, otp: '654321' });

    expect(res).toMatchObject({ access_token: 'verified-staff-jwt' });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: staffEmail, verified: false }),
        data: { verified: true },
      }),
    );
  });
});
