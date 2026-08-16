import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { BlockedNumbersService } from './blocked-numbers.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  blockedNumber: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

describe('BlockedNumbersService', () => {
  let service: BlockedNumbersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockedNumbersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BlockedNumbersService>(BlockedNumbersService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('lists a user\'s blocked numbers newest-first', async () => {
      mockPrisma.blockedNumber.findMany.mockResolvedValue([]);

      await service.list('u1');

      expect(mockPrisma.blockedNumber.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('block', () => {
    it('normalizes +63 numbers to 0-prefixed before upserting', async () => {
      mockPrisma.blockedNumber.upsert.mockResolvedValue({});

      await service.block('u1', '+639171234567');

      expect(mockPrisma.blockedNumber.upsert).toHaveBeenCalledWith({
        where: { userId_sender: { userId: 'u1', sender: '09171234567' } },
        create: { userId: 'u1', sender: '09171234567', source: 'UserBlock' },
        update: {},
      });
    });

    it('leaves an existing row (e.g. AutoBlock) untouched on re-block', async () => {
      mockPrisma.blockedNumber.upsert.mockResolvedValue({});

      await service.block('u1', '09171234567');

      expect(mockPrisma.blockedNumber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  describe('unblock', () => {
    it('deletes the normalized sender', async () => {
      mockPrisma.blockedNumber.delete.mockResolvedValue({});

      await service.unblock('u1', '+639171234567');

      expect(mockPrisma.blockedNumber.delete).toHaveBeenCalledWith({
        where: { userId_sender: { userId: 'u1', sender: '09171234567' } },
      });
    });

    it('throws NotFoundException when the row does not exist', async () => {
      mockPrisma.blockedNumber.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.unblock('u1', '09171234567')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rethrows unexpected errors', async () => {
      mockPrisma.blockedNumber.delete.mockRejectedValue(new Error('db down'));

      await expect(service.unblock('u1', '09171234567')).rejects.toThrow(
        'db down',
      );
    });
  });
});
