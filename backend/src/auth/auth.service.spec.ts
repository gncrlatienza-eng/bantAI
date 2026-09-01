import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { OtpSmsService } from './otp-sms.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  otpCode: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        {
          provide: OtpSmsService,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      phone: '+639171234567',
      firstName: 'Rey',
      lastName: 'DC',
      email: 'r@x.com',
    };

    it('creates a user and returns a neutral success message when phone is new', async () => {
      const user = { id: 'u1', ...dto };
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);

      const result = await service.register(dto);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: dto.phone },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          phone: dto.phone,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      expect(result.message).toBeDefined();
    });

    it('returns the same neutral message without creating a user when phone already exists', async () => {
      // Anti-enumeration: callers cannot tell whether the phone is registered
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: dto.phone,
      });

      const result = await service.register(dto);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });
  });

  // ── requestOtp ──────────────────────────────────────────────────────────────

  describe('requestOtp', () => {
    const dto = { phone: '+639171234567' };

    beforeEach(() => {
      mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.otpCode.create.mockResolvedValue({});
    });

    it('returns success message', async () => {
      const result = await service.requestOtp(dto);
      expect(result).toEqual({ message: 'OTP generated successfully.' });
    });

    it('generates a 6-digit numeric code', async () => {
      await service.requestOtp(dto);

      const createArg = mockPrisma.otpCode.create.mock.calls[0][0];
      expect(createArg.data.code).toMatch(/^\d{6}$/);
    });

    it('sets expiry ~5 minutes from now', async () => {
      const before = Date.now();
      await service.requestOtp(dto);

      const expiresAt: Date =
        mockPrisma.otpCode.create.mock.calls[0][0].data.expiresAt;
      const diff = expiresAt.getTime() - before;
      expect(diff).toBeGreaterThanOrEqual(4.9 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(5.1 * 60 * 1000);
    });

    it('invalidates previous unused OTPs for the same phone before creating a new one', async () => {
      await service.requestOtp(dto);

      expect(mockPrisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: { phone: dto.phone, verified: false },
        data: { verified: true },
      });
      // updateMany must be called BEFORE create
      const updateOrder =
        mockPrisma.otpCode.updateMany.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.otpCode.create.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(createOrder);
    });
  });

  // ── verifyOtp ───────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { phone: '+639171234567', otp: '123456' };
    const validOtp = {
      id: 'otp-1',
      phone: dto.phone,
      code: dto.otp,
      expiresAt: new Date(Date.now() + 60_000),
      verified: false,
    };
    const existingUser = { id: 'u1', phone: dto.phone };

    it('marks the OTP as verified, looks up the user, and returns a JWT', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(validOtp);
      mockPrisma.otpCode.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockJwt.signAsync.mockResolvedValue('jwt-token');

      const result = await service.verifyOtp(dto);

      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: validOtp.id },
        data: { verified: true },
      });
      expect(result).toMatchObject({
        message: 'Authentication successful.',
        access_token: 'jwt-token',
      });
      // user is NOT returned in the response (no PII in auth payload)
      expect((result as any).user).toBeUndefined();
    });

    it('creates a user if none exists for the verified phone', async () => {
      const newUser = { id: 'u2', phone: dto.phone };
      mockPrisma.otpCode.findFirst.mockResolvedValue(validOtp);
      mockPrisma.otpCode.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(newUser);
      mockJwt.signAsync.mockResolvedValue('jwt-token');

      const result = await service.verifyOtp(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { phone: dto.phone },
      });
      expect(result.access_token).toBe('jwt-token');
    });

    it('throws BadRequestException for an unrecognised OTP code', async () => {
      // Unified error — invalid and expired OTPs both throw BadRequestException
      // so attackers cannot distinguish "wrong code" from "expired code".
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.otpCode.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an expired OTP', async () => {
      const expiredOtp = {
        ...validOtp,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.otpCode.findFirst.mockResolvedValue(expiredOtp);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.otpCode.update).not.toHaveBeenCalled();
    });

    it('does not issue a JWT when OTP is expired', async () => {
      const expiredOtp = {
        ...validOtp,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.otpCode.findFirst.mockResolvedValue(expiredOtp);

      await expect(service.verifyOtp(dto)).rejects.toThrow();
      expect(mockJwt.signAsync).not.toHaveBeenCalled();
    });
  });

  // ── getMe ───────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('returns the user matching the given id', async () => {
      const user = { id: 'u1', phone: '+639171234567' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe('u1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when no user matches the id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('no-such-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
