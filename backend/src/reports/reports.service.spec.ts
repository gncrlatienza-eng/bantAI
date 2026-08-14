import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { ReportsService } from './reports.service';

const mockPrisma = {
  smsMessage: { findUnique: jest.fn() },
  userReport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // --- submit ---

  describe('submit', () => {
    const userId = 'user-1';
    const dto = { messageId: 'msg-1', reportedLabel: 'Spam' };

    it('throws NotFoundException when message not found', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue(null);
      await expect(service.submit(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when message belongs to different user', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId: 'other-user',
        classification: { label: 'Ham' },
      });
      await expect(service.submit(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when reported label matches current label', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { label: 'Spam' },
      });
      await expect(
        service.submit(userId, { messageId: 'msg-1', reportedLabel: 'Spam' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user has already reported this message', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { label: 'Ham' },
      });
      mockPrisma.userReport.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.submit(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates and returns a report', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { label: 'Ham' },
      });
      mockPrisma.userReport.findUnique.mockResolvedValue(null);
      const created = {
        id: 'r1',
        originalLabel: 'Ham',
        reportedLabel: 'Spam',
        status: 'Pending',
        createdAt: new Date(),
      };
      mockPrisma.userReport.create.mockResolvedValue(created);

      const result = await service.submit(userId, dto);
      expect(result).toEqual(created);
      expect(mockPrisma.userReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            messageId: dto.messageId,
            originalLabel: 'Ham',
            reportedLabel: 'Spam',
            status: 'Pending',
          }),
        }),
      );
    });

    it('uses Ham as originalLabel when message has no classification yet', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: null,
      });
      mockPrisma.userReport.findUnique.mockResolvedValue(null);
      mockPrisma.userReport.create.mockResolvedValue({});

      await service.submit(userId, {
        messageId: 'msg-1',
        reportedLabel: 'Scam',
      });
      expect(mockPrisma.userReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ originalLabel: 'Ham' }),
        }),
      );
    });
  });

  // --- findAll / findPending ---

  describe('findAll', () => {
    it('returns all reports ordered by createdAt desc', async () => {
      const reports = [{ id: 'r1' }, { id: 'r2' }];
      mockPrisma.userReport.findMany.mockResolvedValue(reports);

      const result = await service.findAll();
      expect(result).toEqual(reports);
      expect(mockPrisma.userReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findPending', () => {
    it('returns only Pending reports', async () => {
      const pending = [{ id: 'r1', status: 'Pending' }];
      mockPrisma.userReport.findMany.mockResolvedValue(pending);

      const result = await service.findPending();
      expect(result).toEqual(pending);
      expect(mockPrisma.userReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'Pending' } }),
      );
    });
  });

  // --- validate / reject ---

  describe('validate', () => {
    it('sets status to Validated with optional note', async () => {
      const updated = {
        id: 'r1',
        status: 'Validated',
        adminNote: 'Confirmed FN',
        updatedAt: new Date(),
      };
      mockPrisma.userReport.update.mockResolvedValue(updated);

      const result = await service.validate('r1', 'Confirmed FN');
      expect(result).toEqual(updated);
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: { status: 'Validated', adminNote: 'Confirmed FN' },
        }),
      );
    });

    it('stores null when no adminNote is provided', async () => {
      mockPrisma.userReport.update.mockResolvedValue({});
      await service.validate('r1');
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'Validated', adminNote: null },
        }),
      );
    });
  });

  describe('reject', () => {
    it('sets status to Rejected', async () => {
      mockPrisma.userReport.update.mockResolvedValue({
        id: 'r1',
        status: 'Rejected',
      });
      const result = await service.reject('r1', 'Spam is correct');
      expect(result).toBeDefined();
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'Rejected', adminNote: 'Spam is correct' },
        }),
      );
    });
  });

  // --- countValidatedSince ---

  describe('countValidatedSince', () => {
    it('counts Validated reports since the given date', async () => {
      mockPrisma.userReport.count.mockResolvedValue(42);
      const since = new Date('2026-08-01');
      const count = await service.countValidatedSince(since);
      expect(count).toBe(42);
      expect(mockPrisma.userReport.count).toHaveBeenCalledWith({
        where: { status: 'Validated', updatedAt: { gte: since } },
      });
    });
  });
});
