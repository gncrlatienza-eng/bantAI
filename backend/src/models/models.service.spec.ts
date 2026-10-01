import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { bundleDigest } from './model-evidence';
import { ModelsService } from './models.service';

const mockPrisma = {
  modelVersion: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAudit = { record: jest.fn() };
const fetchMock = jest.fn();

const hex = (char: string) => char.repeat(64);
const ARTIFACTS = {
  'config.json': hex('a'),
  'model.safetensors': hex('b'),
  'tokenizer.json': hex('c'),
};
const DIGEST = bundleDigest(ARTIFACTS);
const OTHER_DIGEST = bundleDigest({
  ...ARTIFACTS,
  'model.safetensors': hex('d'),
});

/** A candidate whose evidence is bound to one artifact and one holdout. */
function evidencedCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    versionTag: 'v1',
    status: 'EVALUATING',
    f1Score: 0.9,
    provenance: {
      artifacts: ARTIFACTS,
      bundleDigest: DIGEST,
      datasetVersion: 'dataset-20260930',
      datasetDigest: hex('e'),
    },
    evaluation: {
      macroF1: 0.9,
      versionTag: 'v1',
      holdout: { sha256: hex('f'), rows: 300 },
      perClass: {
        Ham: { support: 100, precision: 0.95, recall: 0.95, f1: 0.95 },
        Spam: { support: 100, precision: 0.85, recall: 0.85, f1: 0.85 },
        Scam: { support: 100, precision: 0.9, recall: 0.9, f1: 0.9 },
      },
    },
    ...overrides,
  };
}

function servingHealth(
  versionTag: string | null,
  ready = true,
  digest: string | null = DIGEST,
) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      model_ready: ready,
      version_tag: versionTag,
      bundle_digest: digest,
    }),
  });
}

describe('ModelsService', () => {
  let service: ModelsService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
    mockPrisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof mockPrisma) => unknown)(mockPrisma)
        : Promise.all(arg as unknown[]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ModelsService>(ModelsService);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // --- findAll ---

  it('findAll returns all versions newest first', async () => {
    const versions = [{ id: 'v2' }, { id: 'v1' }];
    mockPrisma.modelVersion.findMany.mockResolvedValue(versions);
    const result = await service.findAll();
    expect(result).toEqual(versions);
    expect(mockPrisma.modelVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  // --- findActive ---

  it('findActive returns the currently active model', async () => {
    const active = { id: 'v1', isActive: true };
    mockPrisma.modelVersion.findFirst.mockResolvedValue(active);
    const result = await service.findActive();
    expect(result).toEqual(active);
    expect(mockPrisma.modelVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  describe('getServingStatus', () => {
    it('reports a serving checkpoint that matches the active registry row', async () => {
      mockPrisma.modelVersion.findFirst.mockResolvedValue({
        versionTag: 'v1',
        isActive: true,
        provenance: { bundleDigest: DIGEST },
      });
      servingHealth('v1');

      await expect(service.getServingStatus()).resolves.toEqual({
        status: 'ready',
        modelReady: true,
        versionTag: 'v1',
        bundleDigest: DIGEST,
        registryVersionTag: 'v1',
        registryBundleDigest: DIGEST,
        matchesRegistry: true,
      });
    });

    it('does not report a match when the served bytes differ from the registry', async () => {
      mockPrisma.modelVersion.findFirst.mockResolvedValue({
        versionTag: 'v1',
        isActive: true,
        provenance: { bundleDigest: DIGEST },
      });
      servingHealth('v1', true, OTHER_DIGEST);

      await expect(service.getServingStatus()).resolves.toMatchObject({
        versionTag: 'v1',
        registryVersionTag: 'v1',
        matchesRegistry: false,
      });
    });

    it('reports an untracked serving checkpoint without promoting it', async () => {
      mockPrisma.modelVersion.findFirst.mockResolvedValue(null);
      servingHealth('candidate-local', true, null);

      await expect(service.getServingStatus()).resolves.toEqual({
        status: 'ready',
        modelReady: true,
        versionTag: 'candidate-local',
        bundleDigest: null,
        registryVersionTag: null,
        registryBundleDigest: null,
        matchesRegistry: false,
      });
    });

    it('reports unavailable when the AI service cannot be reached', async () => {
      mockPrisma.modelVersion.findFirst.mockResolvedValue(null);
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.getServingStatus()).resolves.toEqual({
        status: 'unavailable',
        modelReady: false,
        versionTag: null,
        bundleDigest: null,
        registryVersionTag: null,
        registryBundleDigest: null,
        matchesRegistry: false,
      });
    });
  });

  // --- register ---

  describe('register', () => {
    const dto = { versionTag: 'v1.0.0', f1Score: 0.9438, accuracy: 0.9544 };

    it('throws ConflictException when versionTag already exists', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('registers the candidate inactive with its holdout evidence', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      const created = { id: 'v1', ...dto, isActive: false };
      mockPrisma.modelVersion.create.mockResolvedValue(created);

      const result = await service.register(dto);
      expect(result).toEqual(created);
      expect(mockPrisma.modelVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            versionTag: 'v1.0.0',
            status: 'EVALUATING',
            evaluation: expect.objectContaining({
              macroF1: 0.9438,
              accuracy: 0.9544,
            }),
          }),
        }),
      );
    });

    it('derives the bundle digest itself instead of trusting the caller', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      mockPrisma.modelVersion.create.mockResolvedValue({ id: 'v1' });

      await service.register({
        ...dto,
        provenance: {
          artifacts: ARTIFACTS,
          bundleDigest: OTHER_DIGEST,
          datasetVersion: 'dataset-a',
        },
      });

      expect(mockPrisma.modelVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provenance: expect.objectContaining({
              bundleDigest: DIGEST,
              datasetVersion: 'dataset-a',
            }),
          }),
        }),
      );
    });

    it('drops a caller-supplied digest that has no artifacts behind it', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      mockPrisma.modelVersion.create.mockResolvedValue({ id: 'v1' });

      await service.register({
        ...dto,
        provenance: { bundleDigest: DIGEST, datasetVersion: 'dataset-a' },
      });

      const { provenance } =
        mockPrisma.modelVersion.create.mock.calls[0][0].data;
      expect(provenance).toEqual({ datasetVersion: 'dataset-a' });
    });

    it('refreshes evidence for a candidate under review with the same files', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        evidencedCandidate({ evaluation: { macroF1: 0.88 } }),
      );
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.findUniqueOrThrow.mockResolvedValue({ id: 'm1' });
      const holdout = evidencedCandidate().evaluation;

      await service.register({
        versionTag: 'v1',
        f1Score: 0.9,
        evaluation: holdout,
        provenance: { artifacts: ARTIFACTS, datasetVersion: 'dataset-b' },
      });

      expect(mockPrisma.modelVersion.create).not.toHaveBeenCalled();
      expect(mockPrisma.modelVersion.updateMany).toHaveBeenCalledWith({
        where: { id: 'm1', status: { in: ['REGISTERED', 'EVALUATING'] } },
        data: expect.objectContaining({
          f1Score: 0.9,
          evaluation: expect.objectContaining({ holdout: holdout.holdout }),
          provenance: expect.objectContaining({ bundleDigest: DIGEST }),
        }),
      });
    });

    it.each([
      [
        'different files',
        { provenance: { artifacts: ARTIFACTS, bundleDigest: OTHER_DIGEST } },
      ],
      ['a candidate past review', { status: 'APPROVED' }],
      ['a legacy row with no recorded files', { provenance: null }],
    ])(
      'refuses to re-register %s under the same tag',
      async (_name, overrides) => {
        mockPrisma.modelVersion.findUnique.mockResolvedValue(
          evidencedCandidate(overrides),
        );
        await expect(
          service.register({
            versionTag: 'v1',
            f1Score: 0.9,
            provenance: { artifacts: ARTIFACTS },
          }),
        ).rejects.toThrow(ConflictException);
        expect(mockPrisma.modelVersion.updateMany).not.toHaveBeenCalled();
      },
    );

    it('refuses malformed artifact digests at registration', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.register({
          ...dto,
          provenance: {
            artifacts: {
              'model.safetensors': 'not-a-digest',
              '../x': hex('a'),
            },
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.modelVersion.create).not.toHaveBeenCalled();
    });
  });

  // --- review ---

  describe('review', () => {
    it('approves a candidate whose evidence is bound to an artifact and holdout', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        evidencedCandidate(),
      );
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.findUniqueOrThrow.mockResolvedValue({
        id: 'm1',
        versionTag: 'v1',
        status: 'APPROVED',
      });

      await service.approve('m1', 'Beats baseline on holdout', 'admin-1');

      expect(mockPrisma.modelVersion.updateMany).toHaveBeenCalledWith({
        where: { id: 'm1', status: { in: ['REGISTERED', 'EVALUATING'] } },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedByUserId: 'admin-1',
          reviewNote: 'Beats baseline on holdout',
        }),
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MODEL_CANDIDATE_APPROVED' }),
        mockPrisma,
      );
    });

    it('refuses a bare score with no artifact, dataset, or holdout binding', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({
        id: 'm0',
        versionTag: 'v0',
        status: 'REGISTERED',
        f1Score: 0.91,
        evaluation: { macroF1: 0.91 },
        provenance: null,
      });

      const attempt = service.approve(
        'm0',
        'Reviewed approval packet',
        'admin-1',
      );
      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(
        /artifacts.*datasetVersion.*holdout/s,
      );
      expect(mockPrisma.modelVersion.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a macro-F1 that is not the per-class mean',
        { evaluation: { ...evidencedCandidate().evaluation, macroF1: 0.99 } },
        /not the mean/,
      ],
      [
        'a registered f1Score that differs from the evidence',
        { f1Score: 0.97 },
        /f1Score does not match/,
      ],
      [
        'supports that do not add up to the holdout',
        {
          evaluation: {
            ...evidencedCandidate().evaluation,
            holdout: { sha256: hex('f'), rows: 250 },
          },
        },
        /sum to 300/,
      ],
      [
        'evidence recorded for a different version',
        {
          evaluation: {
            ...evidencedCandidate().evaluation,
            versionTag: 'v-other',
          },
        },
        /does not match v1/,
      ],
      [
        'a per-class F1 inconsistent with precision and recall',
        {
          evaluation: {
            ...evidencedCandidate().evaluation,
            perClass: {
              ...evidencedCandidate().evaluation.perClass,
              Ham: { support: 100, precision: 0.5, recall: 0.5, f1: 0.95 },
            },
          },
        },
        /Ham\.f1 is inconsistent/,
      ],
    ])('refuses %s', async (_name, overrides, message) => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        evidencedCandidate(overrides),
      );
      await expect(
        service.approve('m1', 'Reviewed approval packet', 'admin-1'),
      ).rejects.toThrow(message);
      expect(mockPrisma.modelVersion.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to approve a version that is not awaiting review', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'REJECTED',
        f1Score: 0.94,
      });
      await expect(
        service.approve('m1', 'Looks fine to me', 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('never rejects the serving model', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'ACTIVE',
        isActive: true,
      });
      await expect(
        service.reject('m1', 'Should not be possible', 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown version', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.approve('missing', 'Approve this one', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reports a concurrent state change as a conflict', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        evidencedCandidate(),
      );
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.approve('m1', 'Beats baseline on holdout', 'admin-1'),
      ).rejects.toThrow(/changed state/);
      expect(mockAudit.record).not.toHaveBeenCalled();
    });
  });

  // --- deployment ---

  describe('deployment', () => {
    const requested = (overrides: Record<string, unknown> = {}) => ({
      id: 'm2',
      versionTag: 'v2',
      status: 'ACTIVATION_REQUESTED',
      runtimeActivationConfirmedAt: null,
      provenance: { artifacts: ARTIFACTS, bundleDigest: DIGEST },
      ...overrides,
    });

    it('only requests deployment of an approved version', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'EVALUATING',
        isActive: false,
      });
      await expect(
        service.requestActivation('m1', 'Ship after review', 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a second pending deployment', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({
        id: 'm2',
        status: 'APPROVED',
        isActive: false,
      });
      mockPrisma.modelVersion.findFirst.mockResolvedValue({ versionTag: 'v1' });
      await expect(
        service.requestActivation('m2', 'Ship after review', 'admin-1'),
      ).rejects.toThrow(/already pending/);
    });

    it('does not confirm while the AI service serves a different version', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(requested());
      mockPrisma.modelVersion.findFirst.mockResolvedValue({ versionTag: 'v1' });
      servingHealth('v1');

      await expect(service.confirmActivation('m2', 'admin-1')).rejects.toThrow(
        /serving v1, not v2/,
      );
      expect(mockPrisma.modelVersion.updateMany).not.toHaveBeenCalled();
    });

    it('does not confirm while the AI service is unreachable', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(requested());
      mockPrisma.modelVersion.findFirst.mockResolvedValue(null);
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.confirmActivation('m2', 'admin-1')).rejects.toThrow(
        /unreachable/,
      );
    });

    it('does not confirm when the right tag serves the wrong bytes', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(requested());
      mockPrisma.modelVersion.findFirst.mockResolvedValue(null);
      servingHealth('v2', true, OTHER_DIGEST);

      await expect(service.confirmActivation('m2', 'admin-1')).rejects.toThrow(
        /not the approved bundle/,
      );
      expect(mockPrisma.modelVersion.updateMany).not.toHaveBeenCalled();
    });

    it('does not confirm against an AI service that reports no digest', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(requested());
      mockPrisma.modelVersion.findFirst.mockResolvedValue(null);
      servingHealth('v2', true, null);

      await expect(service.confirmActivation('m2', 'admin-1')).rejects.toThrow(
        /does not report an artifact digest/,
      );
    });

    it('does not confirm a version that has no recorded artifact digest', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        requested({ provenance: null }),
      );
      servingHealth('v2');

      await expect(service.confirmActivation('m2', 'admin-1')).rejects.toThrow(
        /no recorded artifact digest/,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('activates only after /health reports the exact version and bundle', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(requested());
      mockPrisma.modelVersion.findFirst.mockResolvedValue({ versionTag: 'v1' });
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.findUniqueOrThrow.mockResolvedValue({
        id: 'm2',
        status: 'ACTIVE',
        isActive: true,
      });
      servingHealth('v2');

      await service.confirmActivation('m2', 'admin-1');

      expect(mockPrisma.modelVersion.updateMany).toHaveBeenNthCalledWith(1, {
        where: { isActive: true, id: { not: 'm2' } },
        data: { isActive: false, status: 'APPROVED' },
      });
      expect(mockPrisma.modelVersion.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'm2', status: 'ACTIVATION_REQUESTED' },
          data: expect.objectContaining({
            isActive: true,
            status: 'ACTIVE',
            isRollback: false,
            runtimeActivationConfirmedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MODEL_ACTIVATION_CONFIRMED',
          metadata: expect.objectContaining({ bundleDigest: DIGEST }),
        }),
        mockPrisma,
      );
    });

    it('records a redeployment of a previously served version as a rollback', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(
        requested({
          id: 'm1',
          versionTag: 'v1',
          runtimeActivationConfirmedAt: new Date('2026-09-01'),
        }),
      );
      mockPrisma.modelVersion.findFirst.mockResolvedValue({ versionTag: 'v2' });
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.findUniqueOrThrow.mockResolvedValue({ id: 'm1' });
      servingHealth('v1');

      await service.confirmActivation('m1', 'admin-1');

      expect(mockPrisma.modelVersion.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ isRollback: true }),
        }),
      );
    });
  });
});
