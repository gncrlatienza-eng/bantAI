import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DatasetsService } from './datasets.service';
import {
  ConfirmCandidateDto,
  ReviewQueueQueryDto,
} from './dto/review-queue.dto';

const OPTED_IN = new Date('2026-10-15T00:00:00Z');
const AFTER = new Date('2026-10-15T01:00:00Z');
const BEFORE = new Date('2026-10-14T23:00:00Z');

function message(
  id: string,
  overrides: Partial<{
    body: string;
    clusterId: string | null;
    createdAt: Date;
    trainingOptInAt: Date | null;
  }> = {},
) {
  return {
    id,
    body: overrides.body ?? `Reply with your OTP to unlock ${id}`,
    clusterId: overrides.clusterId ?? null,
    receivedAt: AFTER,
    createdAt: overrides.createdAt ?? AFTER,
    user: {
      trainingOptInAt:
        overrides.trainingOptInAt === undefined
          ? OPTED_IN
          : overrides.trainingOptInAt,
    },
    classification: { label: 'Scam', score: 0.98, bucket: 'blocked' },
  };
}

function makePrisma() {
  const prisma = {
    smsMessage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    datasetSample: { create: jest.fn() },
    datasetSampleRevision: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

const audit = { record: jest.fn() };

describe('Detection review queue', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: DatasetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new DatasetsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('reviewQueue', () => {
    it('only considers model-verified, opted-in, unreported, unreviewed messages', async () => {
      prisma.smsMessage.findMany.mockResolvedValue([]);
      await service.reviewQueue('detected');
      const { where } = prisma.smsMessage.findMany.mock.calls[0][0];
      expect(where).toMatchObject({
        trusted: true,
        reviewDismissedAt: null,
        datasetSample: { is: null },
        reports: { none: {} },
        user: { trainingOptIn: true },
        classification: { is: { label: 'Scam' } },
      });
    });

    it.each([
      ['uncertain', { bucket: 'unknown' }],
      ['spot_check', { label: 'Ham', bucket: 'safe' }],
    ] as const)('selects %s candidates', async (kind, classification) => {
      prisma.smsMessage.findMany.mockResolvedValue([]);
      await service.reviewQueue(kind);
      const { where } = prisma.smsMessage.findMany.mock.calls[0][0];
      expect(where.classification).toEqual({ is: classification });
    });

    it('never offers a message ingested before the owner opted in', async () => {
      prisma.smsMessage.findMany.mockResolvedValue([
        message('m-before', { createdAt: BEFORE }),
        message('m-after'),
        message('m-no-consent-time', { trainingOptInAt: null }),
      ]);
      const queue = await service.reviewQueue('detected');
      expect(queue.map((c) => c.messageId)).toEqual(['m-after']);
    });

    it('collapses a campaign and identical text to one candidate', async () => {
      prisma.smsMessage.findMany.mockResolvedValue([
        message('m1', { clusterId: 'c1', body: 'Blast A variant one' }),
        message('m2', { clusterId: 'c1', body: 'Blast A variant two' }),
        message('m3', { body: 'Same text' }),
        message('m4', { body: 'Same text' }),
        message('m5', { body: 'Different text' }),
      ]);
      const queue = await service.reviewQueue('detected');
      expect(queue.map((c) => c.messageId)).toEqual(['m1', 'm3', 'm5']);
    });

    it('returns masked text and never the sender', async () => {
      prisma.smsMessage.findMany.mockResolvedValue([
        message('m1', { body: 'Pay at https://evil.example/now' }),
      ]);
      const [candidate] = await service.reviewQueue('detected');
      expect(candidate.maskedText).not.toContain('evil.example');
      expect(candidate).not.toHaveProperty('sender');
      const { select } = prisma.smsMessage.findMany.mock.calls[0][0];
      expect(select.sender).toBeUndefined();
    });
  });

  describe('confirmCandidate', () => {
    it('adds a reviewed_detection sample with a revision and an audit event', async () => {
      prisma.smsMessage.findFirst.mockResolvedValue(message('m1'));
      prisma.datasetSample.create.mockResolvedValue({
        id: 's1',
        maskedText: 'masked',
        label: 'Scam',
        language: null,
      });

      await service.confirmCandidate('m1', { label: 'Scam' }, 'admin-1');

      expect(prisma.datasetSample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceMessageId: 'm1',
            label: 'Scam',
            provenance: 'reviewed_detection',
            consentConfirmed: true,
            reviewedByUserId: 'admin-1',
          }),
        }),
      );
      expect(prisma.datasetSampleRevision.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            messageId: 'm1',
            source: 'review_queue',
          }),
        }),
        prisma,
      );
    });

    it('uses the admin label, not the model label', async () => {
      prisma.smsMessage.findFirst.mockResolvedValue(message('m1'));
      prisma.datasetSample.create.mockResolvedValue({ id: 's1' });
      await service.confirmCandidate('m1', { label: 'Ham' }, 'admin-1');
      expect(prisma.datasetSample.create.mock.calls[0][0].data.label).toBe(
        'Ham',
      );
    });

    it('refuses a message that is not an eligible candidate', async () => {
      prisma.smsMessage.findFirst.mockResolvedValue(null);
      await expect(
        service.confirmCandidate('m1', { label: 'Scam' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.datasetSample.create).not.toHaveBeenCalled();
    });

    it('refuses a message ingested before the owner opted in', async () => {
      prisma.smsMessage.findFirst.mockResolvedValue(
        message('m1', { createdAt: BEFORE }),
      );
      await expect(
        service.confirmCandidate('m1', { label: 'Scam' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports a second confirmation as a conflict', async () => {
      prisma.smsMessage.findFirst.mockResolvedValue(message('m1'));
      prisma.datasetSample.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.confirmCandidate('m1', { label: 'Scam' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('skipCandidate', () => {
    it('marks an eligible candidate as dismissed', async () => {
      prisma.smsMessage.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.skipCandidate('m1')).resolves.toEqual({
        messageId: 'm1',
        skipped: true,
      });
      const { where, data } = prisma.smsMessage.updateMany.mock.calls[0][0];
      expect(where).toMatchObject({ id: 'm1', user: { trainingOptIn: true } });
      expect(data.reviewDismissedAt).toBeInstanceOf(Date);
    });

    it('404s when the message is not a candidate', async () => {
      prisma.smsMessage.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.skipCandidate('m1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('validation', () => {
    const errorsFor = <T extends object>(
      cls: new () => T,
      body: Record<string, unknown>,
    ) =>
      validate(plainToInstance(cls, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

    it('requires a known queue kind', async () => {
      await expect(
        errorsFor(ReviewQueueQueryDto, { kind: 'detected' }),
      ).resolves.toHaveLength(0);
      await expect(
        errorsFor(ReviewQueueQueryDto, { kind: 'everything' }),
      ).resolves.not.toHaveLength(0);
    });

    it('requires a training label', async () => {
      await expect(
        errorsFor(ConfirmCandidateDto, { label: 'Spam' }),
      ).resolves.toHaveLength(0);
      await expect(
        errorsFor(ConfirmCandidateDto, { label: 'Unknown' }),
      ).resolves.not.toHaveLength(0);
      await expect(
        errorsFor(ConfirmCandidateDto, {}),
      ).resolves.not.toHaveLength(0);
    });
  });
});
