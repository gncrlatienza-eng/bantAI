import { CloudVerificationStatus } from '@prisma/client';

import { CloudVerificationService } from './cloud-verification.service';

describe('CloudVerificationService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.CLOUD_VERIFY_MODEL_VERSION = 'v-test';
    process.env.CLOUD_VERIFY_ARTIFACT_DIGEST = 'a'.repeat(64);
    process.env.CLOUD_VERIFY_ADMISSION_DAILY = '10';
    process.env.CLOUD_VERIFY_ADMISSION_MONTHLY = '120';
    delete process.env.AZURE_STORAGE_QUEUE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      cloudVerificationJob: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      cloudVerificationAdmission: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(
        async (work: (tx: unknown) => unknown) => await work(prisma),
      ),
      $executeRaw: jest.fn(),
      ...overrides,
    };
    const ai = {
      waitForPinnedReadiness: jest.fn(),
      classifyPinned: jest.fn(),
    };
    const queue = {
      configured: jest.fn(() => true),
      publish: jest.fn(),
      poison: jest.fn(),
      delete: jest.fn(),
      renew: jest.fn(),
    };
    return {
      service: new CloudVerificationService(
        prisma as never,
        ai as never,
        queue as never,
      ),
      prisma,
      ai,
      queue,
    };
  }

  it('does not overwrite a result verified while its queue message is publishing', async () => {
    const { service, prisma, queue } = makeService();
    const pending = {
      id: '11111111-1111-4111-8111-111111111111',
      status: CloudVerificationStatus.pending,
    };
    const verified = { ...pending, status: CloudVerificationStatus.verified };
    prisma.cloudVerificationJob.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(verified);
    prisma.cloudVerificationJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.publishAfterCommit(pending.id)).resolves.toEqual(
      verified,
    );
    expect(queue.publish).toHaveBeenCalledWith(pending.id);
    expect(prisma.cloudVerificationJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              CloudVerificationStatus.pending,
              CloudVerificationStatus.retryable_failure,
            ],
          },
        }),
      }),
    );
  });

  it('does not wake Model C after the admission budget denies a request', async () => {
    const { service, prisma, ai } = makeService();
    prisma.cloudVerificationAdmission.findUnique.mockResolvedValue(null);
    prisma.cloudVerificationAdmission.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10);

    await expect(service.wake('user-1')).rejects.toThrow(
      'Admission limit reached',
    );
    expect(ai.waitForPinnedReadiness).not.toHaveBeenCalled();
  });

  it('terminalizes an expired job at max attempts instead of republishing it', async () => {
    const { service, prisma, queue } = makeService();
    prisma.cloudVerificationJob.findMany.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        status: CloudVerificationStatus.processing,
        attempts: 5,
        maxAttempts: 5,
      },
    ]);
    prisma.cloudVerificationJob.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.repairOutbox()).resolves.toEqual({
      inspected: 1,
      published: 0,
    });
    expect(queue.publish).not.toHaveBeenCalled();
    expect(queue.poison).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(prisma.cloudVerificationJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CloudVerificationStatus.failed,
          lastError: 'attempts_exhausted',
        }),
      }),
    );
  });

  it('preserves the active final attempt when a duplicate delivery arrives', async () => {
    const { service, prisma, queue } = makeService();
    const job = {
      id: '33333333-3333-4333-8333-333333333333',
      status: CloudVerificationStatus.processing,
      attempts: 5,
      maxAttempts: 5,
      leaseExpiresAt: new Date(Date.now() + 120_000),
    };
    prisma.cloudVerificationJob.findUnique.mockResolvedValue(job);
    prisma.cloudVerificationJob.updateMany.mockResolvedValue({ count: 0 });
    await (
      service as unknown as {
        processQueueMessage(message: object): Promise<void>;
      }
    ).processQueueMessage({
      messageId: 'duplicate',
      popReceipt: 'receipt',
      messageText: JSON.stringify({ jobId: job.id }),
    });
    expect(prisma.cloudVerificationJob.updateMany).toHaveBeenCalledTimes(1);
    expect(queue.poison).not.toHaveBeenCalled();
    expect(queue.delete).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'masks legacy message text before inference (feature present: %s)',
    async (hasFeature) => {
      const { service, prisma, ai } = makeService();
      const raw =
        'OTP 123456 email person@example.com phone 09171234567 visit https://example.com/private';
      prisma.cloudVerificationJob.findUnique.mockResolvedValue({
        id: 'legacy-job',
        leaseOwner: (service as unknown as { workerId: string }).workerId,
        modelVersion: 'v-test',
        approvedArtifactDigest: 'a'.repeat(64),
        message: {
          body: raw,
          feature: hasFeature ? { maskedBody: raw } : null,
        },
      });
      ai.waitForPinnedReadiness.mockResolvedValue({
        ready: true,
        matchesExpected: true,
      });
      ai.classifyPinned.mockResolvedValue(null);

      await expect(
        (
          service as unknown as {
            verifyClaimedJob(jobId: string): Promise<void>;
          }
        ).verifyClaimedJob('legacy-job'),
      ).rejects.toThrow('inference_unavailable');
      expect(ai.classifyPinned).toHaveBeenCalledWith(
        'OTP [OTP] email [EMAIL] phone [PHONE] visit [URL]',
        [],
        'v-test',
        'a'.repeat(64),
      );
    },
  );

  it('preserves the result that wins before a manual retry obtains its lock', async () => {
    const verified = {
      id: 'verified-job',
      status: CloudVerificationStatus.verified,
    };
    const findFirst = jest.fn().mockResolvedValue(verified);
    const update = jest.fn();
    const { service, prisma, queue } = makeService({
      smsMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'message' }) },
      cloudVerificationJob: {
        findFirst,
        findUnique: jest.fn().mockResolvedValue(verified),
        update,
      },
    });

    await service.retryForOwner('user', 'message');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findFirst.mock.invocationCallOrder[0],
    );
    expect(update).not.toHaveBeenCalled();
    expect(queue.publish).not.toHaveBeenCalled();
  });
});
