import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DatasetsService } from '../datasets/datasets.service';
import { RetrainingService } from './retraining.service';

type Tx = { $queryRaw: () => Promise<unknown> };

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    $transaction: jest.fn(async (callback: (tx: Tx) => Promise<unknown>) =>
      callback({ $queryRaw: () => Promise.resolve([{ locked: true }]) }),
    ),
    retrainingJob: {
      create: jest.fn().mockResolvedValue({ id: 'job-1' }),
      update: jest.fn(({ data }: { data: object }) =>
        Promise.resolve({ id: 'job-1', ...data }),
      ),
    },
    ...overrides,
  };
}

const audit = { record: jest.fn() } as unknown as AuditService;
const datasets = {
  latestSnapshotTag: jest.fn().mockResolvedValue('dataset-20260930'),
} as unknown as DatasetsService;

function makeService(prisma: object) {
  return new RetrainingService(
    prisma as unknown as PrismaService,
    audit,
    datasets,
  );
}

describe('RetrainingService deployment gate', () => {
  const oldEnabled = process.env.RETRAINING_ENABLED;
  const oldApiKey = process.env.AI_SERVICE_API_KEY;

  afterEach(() => {
    if (oldEnabled === undefined) delete process.env.RETRAINING_ENABLED;
    else process.env.RETRAINING_ENABLED = oldEnabled;
    if (oldApiKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = oldApiKey;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('does not trigger work when the pilot gate is disabled', async () => {
    process.env.RETRAINING_ENABLED = 'false';
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.checkAndTrigger();
    await expect(service.triggerRetrain('manual')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.retrainingJob.create).not.toHaveBeenCalled();
  });

  it('requires the internal key and transmits it when enabled', async () => {
    process.env.RETRAINING_ENABLED = 'true';
    const prisma = makePrisma();
    const service = makeService(prisma);
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          job_id: 'ai-job-7',
          dataset_version: 'dataset-20260930',
        }),
    } as Response);

    delete process.env.AI_SERVICE_API_KEY;
    await expect(service.triggerRetrain('manual')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(request).not.toHaveBeenCalled();

    process.env.AI_SERVICE_API_KEY = 'test-internal-key';
    await service.triggerRetrain('manual', 'admin-1');
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/retrain'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'test-internal-key' }),
      }),
    );
  });

  it('records an accepted job pinned to the newest dataset snapshot', async () => {
    process.env.RETRAINING_ENABLED = 'true';
    process.env.AI_SERVICE_API_KEY = 'test-internal-key';
    const prisma = makePrisma();
    const service = makeService(prisma);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          job_id: 'ai-job-7',
          dataset_version: 'dataset-20260930',
        }),
    } as Response);

    const job = await service.triggerRetrain('manual', 'admin-1');

    expect(prisma.retrainingJob.create).toHaveBeenCalledWith({
      data: {
        trigger: 'manual',
        datasetVersion: 'dataset-20260930',
        requestedByUserId: 'admin-1',
      },
    });
    expect(job).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        providerJobId: 'ai-job-7',
      }),
    );
  });

  it('does not report an AI rejection as a successful trigger', async () => {
    process.env.RETRAINING_ENABLED = 'true';
    process.env.AI_SERVICE_API_KEY = 'test-internal-key';
    const prisma = makePrisma();
    const service = makeService(prisma);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(service.triggerRetrain('manual')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.retrainingJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('releases the in-flight guard when recording the job fails', async () => {
    process.env.RETRAINING_ENABLED = 'true';
    process.env.AI_SERVICE_API_KEY = 'test-internal-key';
    const prisma = makePrisma();
    prisma.retrainingJob.create
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValueOnce({ id: 'job-2' });
    const service = makeService(prisma);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          job_id: 'ai-job-8',
          dataset_version: 'dataset-20260930',
        }),
    } as Response);

    await expect(service.triggerRetrain('manual')).rejects.toThrow(
      'database down',
    );
    await expect(service.triggerRetrain('manual')).resolves.toEqual(
      expect.objectContaining({ status: 'ACCEPTED' }),
    );
  });
});

describe('RetrainingService drift signal', () => {
  function driftPrisma(scores: number[]) {
    return makePrisma({
      modelVersion: { findFirst: jest.fn().mockResolvedValue(null) },
      userReport: { count: jest.fn().mockResolvedValue(0) },
      classification: {
        findMany: jest
          .fn()
          .mockResolvedValue(scores.map((score) => ({ score }))),
      },
    });
  }

  it('reads only server-model (trusted) scores', async () => {
    const prisma = driftPrisma([]);
    await makeService(prisma).evaluateTriggers();
    expect(prisma.classification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ message: { trusted: true } }),
      }),
    );
  });

  it('fires on a sustained confidence drop in the trusted stream', async () => {
    const scores = [
      ...Array.from({ length: 200 }, () => 0.95),
      ...Array.from({ length: 400 }, () => 0.45),
    ];
    await expect(
      makeService(driftPrisma(scores)).evaluateTriggers(),
    ).resolves.toMatchObject({
      triggered: true,
      reason: 'page_hinkley_drift',
      drift: true,
    });
  });

  it('stays quiet on a stable stream or below the minimum sample count', async () => {
    const stable = Array.from({ length: 600 }, (_, i) => 0.9 + (i % 5) / 100);
    await expect(
      makeService(driftPrisma(stable)).evaluateTriggers(),
    ).resolves.toMatchObject({ triggered: false, drift: false });
    await expect(
      makeService(driftPrisma([0.95, 0.1, 0.1])).evaluateTriggers(),
    ).resolves.toMatchObject({ drift: false });
  });
});

describe('RetrainingService frozen dataset identity', () => {
  const oldEnabled = process.env.RETRAINING_ENABLED;
  const oldApiKey = process.env.AI_SERVICE_API_KEY;

  beforeEach(() => {
    process.env.RETRAINING_ENABLED = 'true';
    process.env.AI_SERVICE_API_KEY = 'test-internal-key';
  });

  afterEach(() => {
    if (oldEnabled === undefined) delete process.env.RETRAINING_ENABLED;
    else process.env.RETRAINING_ENABLED = oldEnabled;
    if (oldApiKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = oldApiKey;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('refuses to queue retraining when no dataset snapshot is frozen', async () => {
    (datasets.latestSnapshotTag as jest.Mock).mockResolvedValueOnce(null);
    const prisma = makePrisma();
    const request = jest.spyOn(globalThis, 'fetch');

    await expect(
      makeService(prisma).triggerRetrain('manual', 'admin-1'),
    ).rejects.toThrow(/Freeze a dataset snapshot/);
    expect(prisma.retrainingJob.create).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('always sends the snapshot tag to the AI service', async () => {
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          job_id: 'ai-job-9',
          dataset_version: 'dataset-20260930',
        }),
    } as Response);

    await makeService(makePrisma()).triggerRetrain('manual');

    const body = JSON.parse(
      (request.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({
      trigger: 'manual',
      dataset_version: 'dataset-20260930',
    });
  });

  it('fails the job when the AI service does not record the snapshot tag', async () => {
    const prisma = makePrisma();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_id: 'ai-job-10' }),
    } as Response);

    await expect(makeService(prisma).triggerRetrain('manual')).rejects.toThrow(
      /did not record the dataset version/,
    );
    expect(prisma.retrainingJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });
});

describe('RetrainingService drift investigations', () => {
  afterEach(() => jest.clearAllMocks());

  function investigationPrisma(current: object | null) {
    const client = makePrisma({
      driftInvestigation: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
    });
    // Interactive transactions run against the same mock client.
    client.$transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(client)),
    ) as unknown as typeof client.$transaction;
    return client as typeof client & {
      driftInvestigation: { updateMany: jest.Mock };
    };
  }
  let prisma: ReturnType<typeof investigationPrisma>;

  it('requires a recorded finding to resolve an investigation', async () => {
    prisma = investigationPrisma({ id: 'inv-1', status: 'INVESTIGATING' });
    const service = makeService(prisma);
    await expect(
      service.updateInvestigation('inv-1', { status: 'RESOLVED' }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never reopens a closed investigation', async () => {
    prisma = investigationPrisma({ id: 'inv-1', status: 'DISMISSED' });
    const service = makeService(prisma);
    await expect(
      service.updateInvestigation(
        'inv-1',
        { status: 'INVESTIGATING' },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resolves with the finding and the reviewer', async () => {
    prisma = investigationPrisma({ id: 'inv-1', status: 'OPEN' });
    const service = makeService(prisma);
    await service.updateInvestigation(
      'inv-1',
      { status: 'RESOLVED', resolution: 'Seasonal promo spike, no retrain' },
      'admin-1',
    );
    expect(prisma.driftInvestigation.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: 'OPEN' },
      data: expect.objectContaining({
        status: 'RESOLVED',
        resolution: 'Seasonal promo spike, no retrain',
        resolvedByUserId: 'admin-1',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRIFT_INVESTIGATION_UPDATED' }),
      prisma,
    );
  });
});
