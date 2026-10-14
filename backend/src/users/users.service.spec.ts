import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UsersService, trainingConsentUpdate } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('updateMe', () => {
    const userId = 'u1';
    const existingUser = { id: userId, phone: '+639171234567' };

    beforeEach(() => {
      // Default: user exists
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateMe(userId, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('updates all profile fields and returns the updated user', async () => {
      const dto = {
        firstName: 'Reymark',
        lastName: 'De Castro',
      };
      const updated = { id: userId, phone: '+639171234567', ...dto };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(userId, dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        }),
      );
      expect(result).toEqual(updated);
    });

    // Audit AUTH-02 (2026-10-13): even if a caller bypasses DTO validation,
    // the service must never write the login email.
    it('never writes the login email, even if one reaches the service', async () => {
      mockPrisma.user.update.mockResolvedValue(existingUser);
      const smuggled = {
        firstName: 'Reymark',
        email: 'attacker@example.com',
      } as unknown as UpdateProfileDto;

      await service.updateMe(userId, smuggled);

      const { data } = mockPrisma.user.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('email');
    });

    it('updates with only firstName when other fields are omitted', async () => {
      const dto = { firstName: 'Reymark' };
      const updated = {
        id: userId,
        phone: '+639171234567',
        firstName: 'Reymark',
        lastName: null,
        email: null,
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(userId, dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: 'Reymark', lastName: undefined },
        }),
      );
      expect(result).toEqual(updated);
    });

    it('passes the correct userId to the where clause', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      mockPrisma.user.update.mockResolvedValue({ id: 'u2' });

      await service.updateMe('u2', { firstName: 'Gio' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u2' } }),
      );
    });
  });
});

describe('trainingConsentUpdate', () => {
  it('stamps the time when a user opts in', () => {
    const update = trainingConsentUpdate(false, true);
    expect(update.trainingOptIn).toBe(true);
    expect(update.trainingOptInAt).toBeInstanceOf(Date);
  });

  it('keeps the original time when an opted-in user opts in again', () => {
    expect(trainingConsentUpdate(true, true)).toEqual({});
  });

  it('clears the time when a user opts out', () => {
    expect(trainingConsentUpdate(true, false)).toEqual({
      trainingOptIn: false,
      trainingOptInAt: null,
    });
  });

  it('leaves consent alone when the request does not mention it', () => {
    expect(trainingConsentUpdate(true, undefined)).toEqual({});
    expect(trainingConsentUpdate(false, undefined)).toEqual({});
  });
});
