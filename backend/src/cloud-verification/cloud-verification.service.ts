import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudVerificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { maskSmsBody } from '../sms/sms-privacy-masker';
import { cloudVerificationConfig } from './cloud-verification.config';
import { CloudVerificationQueue } from './cloud-verification.queue';

type Tx = Prisma.TransactionClient;
type SafeError =
  | 'queue_unavailable'
  | 'model_not_ready'
  | 'model_identity_mismatch'
  | 'inference_unavailable'
  | 'invalid_model_response'
  | 'lease_lost'
  | 'admission_limit'
  | 'attempts_exhausted';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CloudVerificationService implements OnModuleInit, OnModuleDestroy {
  private readonly config = cloudVerificationConfig();
  private readonly workerId = randomUUID();
  private stopped = false;
  private poller: Promise<void> | null = null;
  private inferenceTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly queue: CloudVerificationQueue,
  ) {}

  onModuleInit() {
    if (this.config.consumerEnabled) this.poller = this.pollLoop();
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.poller;
  }

  identity() {
    return {
      modelVersion: this.config.modelVersion,
      approvedArtifactDigest: this.config.artifactDigest,
    };
  }

  async createJobInTransaction(
    tx: Tx,
    userId: string,
    messageId: string,
    alreadyVerified: boolean,
  ) {
    const identity = this.identity();
    const existing = await tx.cloudVerificationJob.findUnique({
      where: {
        messageId_modelVersion_approvedArtifactDigest: {
          messageId,
          modelVersion: identity.modelVersion,
          approvedArtifactDigest: identity.approvedArtifactDigest,
        },
      },
    });
    if (existing) return existing;

    const admission = await this.admitInTransaction(
      tx,
      userId,
      `message:${messageId}:${identity.modelVersion}:${identity.approvedArtifactDigest}`,
      'classification',
    );
    return tx.cloudVerificationJob.create({
      data: {
        messageId,
        ...identity,
        maxAttempts: this.config.maxAttempts,
        status: alreadyVerified
          ? CloudVerificationStatus.verified
          : admission !== 'limited'
            ? CloudVerificationStatus.pending
            : CloudVerificationStatus.failed,
        ...(alreadyVerified ? { resultCommittedAt: new Date() } : {}),
        ...(admission === 'limited' && !alreadyVerified
          ? { lastError: 'admission_limit' }
          : {}),
      },
    });
  }

  async publishAfterCommit(jobId: string) {
    const job = await this.prisma.cloudVerificationJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status === CloudVerificationStatus.verified) return job;
    if (job.status === CloudVerificationStatus.failed) return job;
    try {
      await this.queue.publish(job.id);
      await this.prisma.cloudVerificationJob.updateMany({
        where: {
          id: job.id,
          status: {
            in: [
              CloudVerificationStatus.pending,
              CloudVerificationStatus.retryable_failure,
            ],
          },
          leaseOwner: null,
        },
        data: {
          publishedAt: new Date(),
          status: CloudVerificationStatus.pending,
          lastError: null,
          retryAfter: null,
        },
      });
      return this.prisma.cloudVerificationJob.findUnique({
        where: { id: job.id },
      });
    } catch {
      const retryAfter = new Date(Date.now() + 60_000);
      await this.prisma.cloudVerificationJob.updateMany({
        where: {
          id: job.id,
          status: {
            in: [
              CloudVerificationStatus.pending,
              CloudVerificationStatus.retryable_failure,
            ],
          },
          leaseOwner: null,
        },
        data: {
          status: CloudVerificationStatus.retryable_failure,
          lastError: 'queue_unavailable',
          retryAfter,
          availableAt: retryAfter,
        },
      });
      return this.prisma.cloudVerificationJob.findUnique({
        where: { id: job.id },
      });
    }
  }

  async getForOwner(userId: string, messageId: string) {
    const message = await this.prisma.smsMessage.findFirst({
      where: { id: messageId, userId },
      select: { id: true, trusted: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    let job = await this.prisma.cloudVerificationJob.findFirst({
      where: {
        messageId,
        modelVersion: this.config.modelVersion,
        approvedArtifactDigest: this.config.artifactDigest,
      },
    });
    if (!job) {
      job = await this.prisma.$transaction((tx) =>
        this.createJobInTransaction(tx, userId, messageId, false),
      );
      if (job.status === CloudVerificationStatus.pending) {
        job = (await this.publishAfterCommit(job.id)) ?? job;
      }
    }
    return { cloudVerification: this.present(job) };
  }

  async retryForOwner(userId: string, messageId: string) {
    const message = await this.prisma.smsMessage.findFirst({
      where: { id: messageId, userId },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    const job = await this.prisma.$transaction(async (tx) => {
      // Re-read under a row lock so a concurrent retry cannot clear a result
      // or lease committed after this request first inspected the job.
      await tx.$executeRaw`
        SELECT 1 FROM "CloudVerificationJob"
        WHERE "messageId" = ${messageId}
          AND "modelVersion" = ${this.config.modelVersion}
          AND "approvedArtifactDigest" = ${this.config.artifactDigest}
        FOR UPDATE
      `;
      const current = await tx.cloudVerificationJob.findFirst({
        where: {
          messageId,
          modelVersion: this.config.modelVersion,
          approvedArtifactDigest: this.config.artifactDigest,
        },
      });
      if (!current) {
        return this.createJobInTransaction(tx, userId, messageId, false);
      }
      if (
        current.status !== CloudVerificationStatus.failed &&
        current.status !== CloudVerificationStatus.retryable_failure
      ) {
        return current;
      }
      const admission = await this.admitInTransaction(
        tx,
        userId,
        `retry:${current.id}:${current.attempts}:${Date.now()}`,
        'manual_retry',
      );
      if (admission !== 'admitted') {
        throw new HttpException(
          'Admission limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return tx.cloudVerificationJob.update({
        where: { id: current.id },
        data: {
          status: CloudVerificationStatus.pending,
          attempts: 0,
          publishedAt: null,
          availableAt: new Date(),
          retryAfter: null,
          lastError: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
    });
    const published = await this.publishAfterCommit(job.id);
    return { cloudVerification: this.present(published ?? job) };
  }

  async wake(userId: string) {
    const bucket = Math.floor(Date.now() / 300_000);
    const admission = await this.prisma.$transaction((tx) =>
      this.admitInTransaction(tx, userId, `wake:${userId}:${bucket}`, 'wake'),
    );
    if (admission === 'limited') {
      throw new HttpException(
        'Admission limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.ai.waitForPinnedReadiness(
      this.config.modelVersion,
      this.config.artifactDigest,
    );
  }

  async repairOutbox(limit = 100) {
    if (!this.queue.configured()) {
      throw new ServiceUnavailableException(
        'Verification queue is unavailable',
      );
    }
    const stale = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const jobs = await this.prisma.cloudVerificationJob.findMany({
      where: {
        OR: [
          {
            status: {
              in: [
                CloudVerificationStatus.pending,
                CloudVerificationStatus.retryable_failure,
              ],
            },
            availableAt: { lte: new Date() },
            OR: [{ publishedAt: null }, { publishedAt: { lte: stale } }],
          },
          {
            status: CloudVerificationStatus.processing,
            leaseExpiresAt: { lt: new Date() },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    let published = 0;
    for (const job of jobs) {
      if (job.attempts >= job.maxAttempts) {
        const exhausted = await this.prisma.cloudVerificationJob.updateMany({
          where: {
            id: job.id,
            status: { not: CloudVerificationStatus.verified },
            attempts: { gte: job.maxAttempts },
            OR: [
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lt: new Date() } },
            ],
          },
          data: {
            status: CloudVerificationStatus.failed,
            lastError: 'attempts_exhausted',
            retryAfter: null,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        if (exhausted.count === 1) await this.queue.poison(job.id);
        continue;
      }
      if (job.status === CloudVerificationStatus.processing) {
        await this.prisma.cloudVerificationJob.updateMany({
          where: {
            id: job.id,
            status: CloudVerificationStatus.processing,
            leaseExpiresAt: { lt: new Date() },
          },
          data: {
            status: CloudVerificationStatus.retryable_failure,
            lastError: 'lease_lost',
            availableAt: new Date(),
            retryAfter: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      }
      const result = await this.publishAfterCommit(job.id);
      if (result?.publishedAt) published += 1;
    }
    return { inspected: jobs.length, published };
  }

  present(job: {
    id: string;
    status: CloudVerificationStatus;
    attempts: number;
    lastError: string | null;
    retryAfter: Date | null;
    modelVersion: string;
    approvedArtifactDigest: string;
    updatedAt: Date;
  }) {
    return {
      jobId: job.id,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
      retryAfter: job.retryAfter,
      modelVersion: job.modelVersion,
      approvedArtifactDigest: job.approvedArtifactDigest,
      updatedAt: job.updatedAt,
    };
  }

  private async admitInTransaction(
    tx: Tx,
    userId: string,
    admissionKey: string,
    kind: string,
  ): Promise<'admitted' | 'existing' | 'limited'> {
    const existing = await tx.cloudVerificationAdmission.findUnique({
      where: { admissionKey },
      select: { id: true },
    });
    if (existing) return 'existing';
    // Serialize the small global budget counter across replicas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1610612736)`;
    const afterLock = await tx.cloudVerificationAdmission.findUnique({
      where: { admissionKey },
      select: { id: true },
    });
    if (afterLock) return 'existing';
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [daily, monthly] = await Promise.all([
      tx.cloudVerificationAdmission.count({
        where: { admittedAt: { gte: dayStart } },
      }),
      tx.cloudVerificationAdmission.count({
        where: { admittedAt: { gte: monthStart } },
      }),
    ]);
    if (
      daily >= this.config.admissionDaily ||
      monthly >= this.config.admissionMonthly
    ) {
      return 'limited';
    }
    await tx.cloudVerificationAdmission.create({
      data: { userId, admissionKey, kind },
    });
    return 'admitted';
  }

  private async pollLoop() {
    while (!this.stopped) {
      try {
        const message = await this.queue.receive();
        if (!message) {
          await this.pause(2_000);
          continue;
        }
        await this.serializeInference(() => this.processQueueMessage(message));
      } catch {
        await this.pause(5_000);
      }
    }
  }

  private async serializeInference(work: () => Promise<void>) {
    const previous = this.inferenceTail;
    let release!: () => void;
    this.inferenceTail = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      await work();
    } finally {
      release();
    }
  }

  private async processQueueMessage(message: {
    messageId: string;
    popReceipt: string;
    messageText: string;
  }) {
    let parsed: { jobId?: unknown };
    try {
      parsed = JSON.parse(message.messageText) as { jobId?: unknown };
    } catch {
      await this.queue.delete(message.messageId, message.popReceipt);
      return;
    }
    if (typeof parsed.jobId !== 'string' || !UUID.test(parsed.jobId)) {
      await this.queue.delete(message.messageId, message.popReceipt);
      return;
    }
    const job = await this.prisma.cloudVerificationJob.findUnique({
      where: { id: parsed.jobId },
    });
    if (
      !job ||
      job.status === CloudVerificationStatus.verified ||
      job.status === CloudVerificationStatus.failed
    ) {
      await this.queue.delete(message.messageId, message.popReceipt);
      return;
    }
    const leaseExpiresAt = new Date(
      Date.now() + this.config.leaseSeconds * 1_000,
    );
    const claimed = await this.prisma.cloudVerificationJob.updateMany({
      where: {
        id: job.id,
        status: {
          in: [
            CloudVerificationStatus.pending,
            CloudVerificationStatus.retryable_failure,
            CloudVerificationStatus.processing,
          ],
        },
        attempts: { lt: job.maxAttempts },
        availableAt: { lte: new Date() },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
      },
      data: {
        status: CloudVerificationStatus.processing,
        leaseOwner: this.workerId,
        leaseExpiresAt,
        attempts: { increment: 1 },
        retryAfter: null,
        lastError: null,
      },
    });
    if (claimed.count !== 1) {
      const current = await this.prisma.cloudVerificationJob.findUnique({
        where: { id: job.id },
        select: {
          status: true,
          attempts: true,
          maxAttempts: true,
          leaseExpiresAt: true,
        },
      });
      if (
        current?.status === CloudVerificationStatus.verified ||
        current?.status === CloudVerificationStatus.failed
      ) {
        await this.queue.delete(message.messageId, message.popReceipt);
      } else if (
        current &&
        current.attempts >= current.maxAttempts &&
        (!current.leaseExpiresAt || current.leaseExpiresAt < new Date())
      ) {
        const exhausted = await this.prisma.cloudVerificationJob.updateMany({
          where: {
            id: job.id,
            status: { not: CloudVerificationStatus.verified },
            attempts: { gte: current.maxAttempts },
            OR: [
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lt: new Date() } },
            ],
          },
          data: {
            status: CloudVerificationStatus.failed,
            lastError: 'attempts_exhausted',
            retryAfter: null,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        if (exhausted.count === 1) await this.queue.poison(job.id);
        await this.queue.delete(message.messageId, message.popReceipt);
      }
      return;
    }

    let popReceipt = message.popReceipt;
    const renewEvery = Math.max(
      10,
      Math.floor(this.config.visibilitySeconds / 2),
    );
    const renewer = setInterval(() => {
      void this.queue
        .renew(message.messageId, popReceipt)
        .then((next) => {
          popReceipt = next;
          return this.prisma.cloudVerificationJob.updateMany({
            where: { id: job.id, leaseOwner: this.workerId },
            data: {
              leaseExpiresAt: new Date(
                Date.now() + this.config.leaseSeconds * 1_000,
              ),
            },
          });
        })
        .catch(() => undefined);
    }, renewEvery * 1_000);
    renewer.unref();
    try {
      await this.verifyClaimedJob(job.id);
      await this.queue.delete(message.messageId, popReceipt);
    } catch (error) {
      const code = this.safeError(error);
      const current = await this.prisma.cloudVerificationJob.findUnique({
        where: { id: job.id },
        select: { attempts: true, maxAttempts: true, status: true },
      });
      if (current?.status === CloudVerificationStatus.verified) {
        await this.queue.delete(message.messageId, popReceipt);
        return;
      }
      const exhausted = !current || current.attempts >= current.maxAttempts;
      if (exhausted) {
        await this.prisma.cloudVerificationJob.updateMany({
          where: { id: job.id, leaseOwner: this.workerId },
          data: {
            status: CloudVerificationStatus.failed,
            lastError: 'attempts_exhausted',
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        await this.queue.poison(job.id);
        await this.queue.delete(message.messageId, popReceipt);
      } else {
        const delay = Math.min(
          900,
          15 * 2 ** Math.max(0, current.attempts - 1),
        );
        const retryAt = new Date(Date.now() + delay * 1_000);
        await this.prisma.cloudVerificationJob.updateMany({
          where: { id: job.id, leaseOwner: this.workerId },
          data: {
            status: CloudVerificationStatus.retryable_failure,
            lastError: code,
            availableAt: retryAt,
            retryAfter: retryAt,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        popReceipt = await this.queue.renew(
          message.messageId,
          popReceipt,
          delay,
        );
      }
    } finally {
      clearInterval(renewer);
    }
  }

  private async verifyClaimedJob(jobId: string) {
    const job = await this.prisma.cloudVerificationJob.findUnique({
      where: { id: jobId },
      include: {
        message: {
          include: {
            feature: true,
            classification: true,
            alerts: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!job || job.leaseOwner !== this.workerId) throw new Error('lease_lost');
    const readiness = await this.ai.waitForPinnedReadiness(
      job.modelVersion,
      job.approvedArtifactDigest,
    );
    if (!readiness.ready) throw new Error('model_not_ready');
    if (!readiness.matchesExpected) throw new Error('model_identity_mismatch');
    // Legacy records and externally supplied feature text are not proof that
    // masking occurred. Apply the canonical mask at this network boundary.
    const maskedBody = maskSmsBody(
      job.message.feature?.maskedBody ?? job.message.body,
    );
    const result = await this.ai.classifyPinned(
      maskedBody,
      [],
      job.modelVersion,
      job.approvedArtifactDigest,
    );
    if (!result) throw new Error('inference_unavailable');

    const committed = await this.prisma.$transaction(async (tx) => {
      // Serialize the result commit with a lease takeover. Without a row lock,
      // a slow worker could pass the ownership check just before its lease
      // expires and overwrite the result of the next worker.
      await tx.$executeRaw`
        SELECT 1
        FROM "CloudVerificationJob"
        WHERE "id" = ${job.id}
        FOR UPDATE
      `;
      const lease = await tx.cloudVerificationJob.findFirst({
        where: {
          id: job.id,
          status: CloudVerificationStatus.processing,
          leaseOwner: this.workerId,
          leaseExpiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!lease) return false;
      const classification = await tx.classification.upsert({
        where: { messageId: job.messageId },
        create: {
          messageId: job.messageId,
          label: result.label,
          score: result.score,
          scores: result.scores ?? undefined,
          bucket: result.bucket,
        },
        update: {
          label: result.label,
          score: result.score,
          scores: result.scores ?? undefined,
          bucket: result.bucket,
          createdAt: new Date(),
        },
      });
      await tx.smsMessage.update({
        where: { id: job.messageId },
        data: { trusted: true },
      });
      if (result.indicators.length) {
        await tx.explainableIndicator.upsert({
          where: { classificationId: classification.id },
          create: {
            classificationId: classification.id,
            indicators: result.indicators,
          },
          update: { indicators: result.indicators },
        });
      }
      const blocked = await tx.blockedNumber.findUnique({
        where: {
          userId_sender: {
            userId: job.message.userId,
            sender: job.message.sender,
          },
        },
        select: { id: true },
      });
      if (
        !blocked &&
        result.bucket === 'blocked' &&
        !job.message.alerts.length
      ) {
        await tx.alert.create({
          data: { messageId: job.messageId, status: 'Pending' },
        });
      }
      if (
        result.bucket !== 'blocked' &&
        job.message.alerts.some((alert) => alert.status === 'Pending')
      ) {
        await tx.alert.deleteMany({
          where: { messageId: job.messageId, status: 'Pending' },
        });
      }
      await tx.cloudVerificationJob.update({
        where: { id: job.id },
        data: {
          status: CloudVerificationStatus.verified,
          resultCommittedAt: new Date(),
          lastError: null,
          retryAfter: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return true;
    });
    if (!committed) throw new Error('lease_lost');
  }

  private safeError(error: unknown): SafeError {
    const value = error instanceof Error ? error.message : '';
    const allowed: SafeError[] = [
      'queue_unavailable',
      'model_not_ready',
      'model_identity_mismatch',
      'inference_unavailable',
      'invalid_model_response',
      'lease_lost',
      'admission_limit',
      'attempts_exhausted',
    ];
    return allowed.includes(value as SafeError)
      ? (value as SafeError)
      : 'inference_unavailable';
  }

  private pause(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
