import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from './reports.service';

const mockPrisma = {
  $transaction: jest.fn((operation) => operation(mockPrisma)),
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
        { provide: AuditService, useValue: { record: jest.fn() } },
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

    it('accepts a confirmation (reported label matches current label)', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { label: 'Scam' },
      });
      mockPrisma.userReport.findUnique.mockResolvedValue(null);
      mockPrisma.userReport.create.mockResolvedValue({ id: 'r2' });
      await service.submit(userId, {
        messageId: 'msg-1',
        reportedLabel: 'Scam',
      });
      expect(mockPrisma.userReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalLabel: 'Scam',
            reportedLabel: 'Scam',
          }),
        }),
      );
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
      const reports = [
        { id: 'r1', message: { id: 'm1', body: 'Click [URL]' } },
        { id: 'r2', message: { id: 'm2', body: 'Win [AMOUNT]' } },
      ];
      mockPrisma.userReport.findMany.mockResolvedValue(reports);

      const result = await service.findAll('admin-1');
      expect(result).toEqual(reports);
      expect(mockPrisma.userReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  it('records a restricted-content read only when content was disclosed', async () => {
    const audit = (service as unknown as { audit: { record: jest.Mock } })
      .audit;
    mockPrisma.userReport.findMany.mockResolvedValue([]);
    await service.findAll('admin-1');
    await service.findPending('admin-1');
    expect(audit.record).not.toHaveBeenCalled();

    mockPrisma.userReport.findMany.mockResolvedValue([
      { id: 'r1', message: { id: 'm1', body: 'Click [URL]' } },
    ]);
    await service.findAll('admin-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESTRICTED_MESSAGE_ACCESSED' }),
    );
  });

  it('re-masks a historical unmasked message body on Admin reads', async () => {
    mockPrisma.userReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        message: { id: 'm1', body: 'Call 09171234567 or bit.ly/abc' },
      },
    ]);

    const [report] = await service.findAll('admin-1');
    expect(report.message.body).toBe('Call [PHONE] or [URL]');
  });

  describe('findPending', () => {
    it('returns only Pending reports', async () => {
      const pending = [
        { id: 'r1', status: 'Pending', message: { id: 'm1', body: 'Hi' } },
      ];
      mockPrisma.userReport.findMany.mockResolvedValue(pending);

      const result = await service.findPending('admin-1');
      expect(result).toEqual(pending);
      expect(mockPrisma.userReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'Pending' },
          select: expect.objectContaining({ status: true }),
        }),
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

      const result = await service.validate('r1', 'admin-1', 'Confirmed FN');
      expect(result).toEqual(updated);
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1', status: 'Pending' },
          data: expect.objectContaining({
            status: 'Validated',
            adminNote: 'Confirmed FN',
          }),
        }),
      );
    });

    it('stores null when no adminNote is provided', async () => {
      mockPrisma.userReport.update.mockResolvedValue({});
      await service.validate('r1', 'admin-1');
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'Validated',
            adminNote: null,
          }),
        }),
      );
    });

    it('sets validatedAt to a current Date', async () => {
      mockPrisma.userReport.update.mockResolvedValue({});
      await service.validate('r1', 'admin-1');
      const call = mockPrisma.userReport.update.mock.calls[0][0];
      expect(call.data.validatedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when report does not exist (P2025)', async () => {
      const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
      mockPrisma.userReport.update.mockRejectedValue(p2025);
      mockPrisma.userReport.findUnique.mockResolvedValue(null);
      await expect(service.validate('missing-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an already reviewed report without creating another audit event', async () => {
      const p2025 = Object.assign(new Error('No pending report'), {
        code: 'P2025',
      });
      mockPrisma.userReport.update.mockRejectedValue(p2025);
      mockPrisma.userReport.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(service.validate('r1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reject', () => {
    it('sets status to Rejected', async () => {
      mockPrisma.userReport.update.mockResolvedValue({
        id: 'r1',
        status: 'Rejected',
      });
      const result = await service.reject('r1', 'admin-1', 'Spam is correct');
      expect(result).toBeDefined();
      expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1', status: 'Pending' },
          data: { status: 'Rejected', adminNote: 'Spam is correct' },
        }),
      );
    });

    it('throws NotFoundException when report does not exist (P2025)', async () => {
      const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
      mockPrisma.userReport.update.mockRejectedValue(p2025);
      mockPrisma.userReport.findUnique.mockResolvedValue(null);
      await expect(service.reject('missing-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a second decision on an already reviewed report', async () => {
      const p2025 = Object.assign(new Error('No pending report'), {
        code: 'P2025',
      });
      mockPrisma.userReport.update.mockRejectedValue(p2025);
      mockPrisma.userReport.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(service.reject('r1', 'admin-1')).rejects.toThrow(
        ConflictException,
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
        where: { status: 'Validated', validatedAt: { gte: since } },
      });
    });
  });
});
