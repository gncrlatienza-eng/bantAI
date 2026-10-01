import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DatasetsService } from './datasets.service';

function makePrisma() {
  const prisma = {
    userReport: { findUnique: jest.fn(), findMany: jest.fn() },
    datasetSample: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    datasetSampleRevision: { create: jest.fn(), findMany: jest.fn() },
    datasetSnapshot: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

const audit = { record: jest.fn() };

describe('DatasetsService', () => {
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

  describe('curateValidatedReport', () => {
    it('only accepts validated reports', async () => {
      prisma.userReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'Pending',
        reportedLabel: 'Scam',
        message: { body: 'masked' },
      });
      await expect(
        service.curateValidatedReport('r1', {}, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.datasetSample.create).not.toHaveBeenCalled();
    });

    it('creates the sample with revision 1 and an audit event', async () => {
      prisma.userReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'Validated',
        reportedLabel: 'Scam',
        message: { body: 'Nanalo po kayo <URL>' },
      });
      prisma.datasetSample.create.mockResolvedValue({
        id: 's1',
        maskedText: 'Nanalo po kayo <URL>',
        label: 'Spam',
        language: 'fil',
      });

      await service.curateValidatedReport(
        'r1',
        { label: 'Spam', language: 'fil' },
        'admin-1',
      );

      expect(prisma.datasetSample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceReportId: 'r1',
            label: 'Spam',
            split: 'TRAIN',
            provenance: 'validated_user_report',
          }),
        }),
      );
      expect(prisma.datasetSampleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 1, action: 'CURATED' }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DATASET_SAMPLE_CURATED' }),
        prisma,
      );
    });

    it('re-masks a historical unmasked body before it enters the dataset', async () => {
      prisma.userReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'Validated',
        reportedLabel: 'Scam',
        message: { body: 'Call 09171234567, OTP 482913 at bit.ly/x' },
      });
      prisma.datasetSample.create.mockImplementation(
        ({ data }: { data: { maskedText: string } }) => ({
          id: 's1',
          maskedText: data.maskedText,
          label: 'Scam',
          language: null,
        }),
      );

      await service.curateValidatedReport('r1', {}, 'admin-1');

      const stored = JSON.stringify([
        prisma.datasetSample.create.mock.calls,
        prisma.datasetSampleRevision.create.mock.calls,
      ]);
      expect(prisma.datasetSample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maskedText: 'Call [PHONE], OTP [OTP] at [URL]',
          }),
        }),
      );
      expect(stored).not.toContain('0917');
      expect(stored).not.toContain('482913');
    });

    it('reports a second curation of the same report as a conflict', async () => {
      prisma.userReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'Validated',
        reportedLabel: 'Ham',
        message: { body: 'masked' },
      });
      prisma.datasetSample.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.curateValidatedReport('r1', {}, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateSample', () => {
    it('never edits the frozen holdout', async () => {
      prisma.datasetSample.findUnique.mockResolvedValue({
        id: 's1',
        split: 'HOLDOUT',
      });
      await expect(
        service.updateSample('s1', { label: 'Ham' }, 'admin-1'),
      ).rejects.toThrow(/holdout/);
      expect(prisma.datasetSample.update).not.toHaveBeenCalled();
    });

    it('records an exclusion as a new version', async () => {
      prisma.datasetSample.findUnique.mockResolvedValue({
        id: 's1',
        split: 'TRAIN',
        label: 'Scam',
        language: 'en',
        included: true,
        version: 3,
      });
      prisma.datasetSample.update.mockResolvedValue({
        id: 's1',
        maskedText: 'masked',
        label: 'Scam',
        language: 'en',
        included: false,
        version: 4,
      });

      await service.updateSample('s1', { included: false }, 'admin-1');

      expect(prisma.datasetSample.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', version: 3 },
          data: expect.objectContaining({ included: false, version: 4 }),
        }),
      );
      expect(prisma.datasetSampleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 4, action: 'EXCLUDED' }),
      });
    });

    it('turns a concurrent edit into a conflict instead of overwriting', async () => {
      prisma.datasetSample.findUnique.mockResolvedValue({
        id: 's1',
        split: 'TRAIN',
        label: 'Scam',
        language: null,
        included: true,
        version: 3,
      });
      prisma.datasetSample.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('stale', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.updateSample('s1', { label: 'Spam' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a no-op change', async () => {
      prisma.datasetSample.findUnique.mockResolvedValue({
        id: 's1',
        split: 'TRAIN',
        label: 'Scam',
        language: null,
        included: true,
        version: 1,
      });
      await expect(
        service.updateSample('s1', { label: 'Scam' }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('snapshots', () => {
    it('freezes included training samples only', async () => {
      prisma.datasetSample.findMany.mockResolvedValue([
        {
          id: 's1',
          version: 2,
          maskedText: 'masked',
          label: 'Scam',
          language: 'en',
          provenance: 'validated_user_report',
        },
      ]);
      prisma.datasetSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        versionTag: 'dataset-a',
        _count: { items: 1 },
      });

      const snapshot = await service.createSnapshot(
        { versionTag: 'dataset-a' },
        'admin-1',
      );

      expect(prisma.datasetSample.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { split: 'TRAIN', included: true, consentConfirmed: true },
        }),
      );
      expect(snapshot).toEqual(
        expect.objectContaining({ versionTag: 'dataset-a', itemCount: 1 }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DATASET_SNAPSHOT_CREATED' }),
        prisma,
      );
    });

    it('exports JSONL rows that FileReportSource can read', async () => {
      prisma.datasetSnapshot.findUnique.mockResolvedValue({
        versionTag: 'dataset-a',
        createdAt: new Date('2026-09-30T00:00:00Z'),
        items: [
          {
            sampleId: 's1',
            sampleVersion: 2,
            maskedText: 'Nanalo po kayo <URL>',
            label: 'Scam',
            language: 'fil',
            provenance: 'validated_user_report',
          },
        ],
      });

      const body = await service.exportSnapshotJsonl('dataset-a', 'admin-1');
      const rows = body
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      expect(rows).toEqual([
        expect.objectContaining({
          text: 'Nanalo po kayo <URL>',
          label: 'Scam',
          report_id: 's1@v2',
          validated_at: '2026-09-30T00:00:00.000Z',
        }),
      ]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'RESTRICTED_MESSAGE_ACCESSED' }),
      );
    });

    it('re-masks unmasked text frozen before server-side masking on export', async () => {
      prisma.datasetSnapshot.findUnique.mockResolvedValue({
        versionTag: 'dataset-a',
        createdAt: new Date('2026-09-30T00:00:00Z'),
        items: [
          {
            sampleId: 's1',
            sampleVersion: 1,
            maskedText: 'Send to juan@mail.com or 0917 123 4567 ref 1234567890',
            label: 'Scam',
            language: null,
            provenance: 'validated_user_report',
          },
        ],
      });

      const body = await service.exportSnapshotJsonl('dataset-a', 'admin-1');

      expect(JSON.parse(body.trim()).text).toBe(
        'Send to [EMAIL] or [PHONE] ref [NUMBER]',
      );
      for (const secret of ['juan@mail.com', '0917', '1234567890']) {
        expect(body).not.toContain(secret);
      }
    });

    it('re-masks sample text while freezing a snapshot', async () => {
      prisma.datasetSample.findMany.mockResolvedValue([
        {
          id: 's1',
          version: 1,
          maskedText: 'PIN 1234 then call 09171234567',
          label: 'Scam',
          language: null,
          provenance: 'validated_user_report',
        },
      ]);
      prisma.datasetSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        versionTag: 'dataset-a',
        _count: { items: 1 },
      });

      await service.createSnapshot({ versionTag: 'dataset-a' }, 'admin-1');

      const frozen =
        prisma.datasetSnapshot.create.mock.calls[0][0].data.items.create;
      expect(frozen[0].maskedText).toBe('PIN [OTP] then call [PHONE]');
    });

    it('returns 404 for an unknown version', async () => {
      prisma.datasetSnapshot.findUnique.mockResolvedValue(null);
      await expect(service.exportSnapshot('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
