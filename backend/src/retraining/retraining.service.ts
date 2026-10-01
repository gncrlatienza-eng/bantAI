import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AuditEventType,
  DriftInvestigationStatus,
  Prisma,
  RetrainingJobStatus,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DatasetsService } from '../datasets/datasets.service';
import { UpdateDriftInvestigationDto } from './dto/update-drift-investigation.dto';

// Minimum validated reports accumulated since the last model promotion
// before a retrain is triggered (WBS 4.1.2).
const REPORT_THRESHOLD = 50;

// Absolute macro-F1 drop (percentage points) that triggers retrain.
// At the 0.9438 baseline, a 5-point drop lands at 0.8938.
const F1_DROP_THRESHOLD = 0.05;

// Page-Hinkley parameters for drift detection on per-message score stream.
// delta: allowance for natural variance; lambda: detection threshold.
const PH_DELTA = 0.005;
const PH_LAMBDA = 50;
const PH_MIN_SAMPLES = 100;
const RETRAIN_LOCK_ID = 2_026_091_600;

const OPEN_STATES: DriftInvestigationStatus[] = [
  DriftInvestigationStatus.OPEN,
  DriftInvestigationStatus.INVESTIGATING,
];

// Allowed investigation moves. Closed states are final: a new signal opens a
// new investigation so the record of the old decision is never rewritten.
const NEXT_STATES: Record<
  DriftInvestigationStatus,
  DriftInvestigationStatus[]
> = {
  OPEN: [
    DriftInvestigationStatus.INVESTIGATING,
    DriftInvestigationStatus.RESOLVED,
    DriftInvestigationStatus.DISMISSED,
  ],
  INVESTIGATING: [
    DriftInvestigationStatus.RESOLVED,
    DriftInvestigationStatus.DISMISSED,
  ],
  RESOLVED: [],
  DISMISSED: [],
};

export interface TriggerEvaluation {
  triggered: boolean;
  reason: string;
  validatedCount: number;
  currentF1: number | null;
  drift: boolean;
}

@Injectable()
export class RetrainingService {
  private readonly logger = new Logger(RetrainingService.name);
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8001';
  private _retrainInFlight = false;

  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly datasets: DatasetsService,
  ) {}

  // Runs every hour. Evaluates all trigger conditions and calls the AI
  // service's /retrain endpoint if any condition is met.
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndTrigger() {
    if (!this.isEnabled()) {
      this.logger.log('Retraining automation is disabled.');
      return;
    }
    this.logger.log('Running retraining trigger check...');

    const result = await this.evaluateTriggers();
    if (!result.triggered) {
      this.logger.log(
        `No retraining trigger. Validated reports: ${result.validatedCount}, F1: ${result.currentF1 ?? 'no model'}, drift: ${result.drift}`,
      );
      return;
    }

    this.logger.warn(
      `Retraining trigger fired: ${result.reason} (validated=${result.validatedCount})`,
    );
    try {
      await this.triggerRetrain(result.reason);
    } catch (error) {
      // The job row already records the failure; the cron retries next hour.
      this.logger.warn(`Automatic retrain failed: ${(error as Error).message}`);
    }
  }

  /** Signal plus the configuration the Admin needs to interpret it. */
  async status() {
    const evaluation = await this.evaluateTriggers();
    return {
      ...evaluation,
      enabled: this.isEnabled(),
      thresholds: {
        validatedReports: REPORT_THRESHOLD,
        f1Drop: F1_DROP_THRESHOLD,
        pageHinkleyDelta: PH_DELTA,
        pageHinkleyLambda: PH_LAMBDA,
        pageHinkleyMinSamples: PH_MIN_SAMPLES,
      },
    };
  }

  // Exposed so the manual trigger endpoint (Sprint 5, 5.3.4) can call it.
  async evaluateTriggers(): Promise<TriggerEvaluation> {
    const activeModel = await this.prisma.modelVersion.findFirst({
      where: { isActive: true },
      orderBy: { promotedAt: 'desc' },
    });

    const lastPromotedAt = activeModel?.promotedAt ?? new Date(0);

    // Condition 1: validated report count since last promotion
    const validatedCount = await this.prisma.userReport.count({
      where: { status: 'Validated', validatedAt: { gte: lastPromotedAt } },
    });

    if (validatedCount >= REPORT_THRESHOLD) {
      return {
        triggered: true,
        reason: 'validated_report_count',
        validatedCount,
        currentF1: activeModel?.f1Score ?? null,
        drift: false,
      };
    }

    // Condition 2: F1 drop vs previous model
    const currentF1 = activeModel?.f1Score ?? null;
    if (activeModel && currentF1 !== null) {
      const bestPrior = await this.prisma.modelVersion.findFirst({
        where: { isActive: false, createdAt: { lt: activeModel.promotedAt } },
        orderBy: { f1Score: 'desc' },
      });

      if (bestPrior && currentF1 - bestPrior.f1Score < -F1_DROP_THRESHOLD) {
        return {
          triggered: true,
          reason: 'f1_degradation',
          validatedCount,
          currentF1,
          drift: false,
        };
      }
    }

    // Condition 3: Page-Hinkley drift on recent classification scores.
    // Only server-model scores count: ingest marks a message trusted exactly
    // when the AI service classified it (sms.service.ts), so client-supplied
    // fallback scores cannot fake or mask drift.
    const recentScores = await this.prisma.classification.findMany({
      where: { createdAt: { gte: lastPromotedAt }, message: { trusted: true } },
      orderBy: { createdAt: 'asc' },
      select: { score: true },
      take: 2000,
    });

    const drift = this.pageHinkley(recentScores.map((c) => c.score));
    if (drift) {
      return {
        triggered: true,
        reason: 'page_hinkley_drift',
        validatedCount,
        currentF1,
        drift: true,
      };
    }

    return {
      triggered: false,
      reason: '',
      validatedCount,
      currentF1,
      drift: false,
    };
  }

  /**
   * Sends a retraining request and records it as a job. The job is pinned to
   * the newest dataset snapshot so the run's training data is identifiable
   * later. The AI service only queues the request (training runs offline), so
   * ACCEPTED means queued, never "trained" or "deployed".
   */
  async triggerRetrain(reason: string, actorUserId?: string) {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Retraining is disabled for this deployment.',
      );
    }
    const apiKey = process.env.AI_SERVICE_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Retraining requires an AI service API key.',
      );
    }
    if (this._retrainInFlight) {
      throw new ConflictException('A retraining job is already in progress.');
    }
    this._retrainInFlight = true;
    try {
      return await this.requestAndRecord(reason, apiKey, actorUserId);
    } finally {
      this._retrainInFlight = false;
    }
  }

  private async requestAndRecord(
    reason: string,
    apiKey: string,
    actorUserId?: string,
  ) {
    this.logger.warn(`Retraining triggered: ${reason}`);
    const datasetVersion = await this.datasets.latestSnapshotTag();
    // An offline run must be able to name the frozen data it trains on
    // (audit 2026-09-30, finding 6); without a snapshot there is nothing
    // reproducible to queue.
    if (!datasetVersion) {
      throw new ConflictException(
        'Freeze a dataset snapshot before requesting retraining; the queued job must name the data it trains on.',
      );
    }
    const job = await this.prisma.retrainingJob.create({
      data: {
        trigger: reason,
        datasetVersion,
        requestedByUserId: actorUserId ?? null,
      },
    });
    try {
      // Transaction-scoped locks remain tied to Prisma's pinned interactive
      // transaction connection and are always released on commit/rollback.
      const providerJobId = await this.prisma.$transaction(
        async (tx) => {
          const locks = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${RETRAIN_LOCK_ID}) AS locked
        `;
          if (!locks[0]?.locked) {
            throw new ConflictException(
              'A retraining job is already in progress.',
            );
          }
          return this.callRetrainEndpoint(reason, apiKey, datasetVersion);
        },
        { timeout: 35_000 },
      );
      const accepted = await this.prisma.retrainingJob.update({
        where: { id: job.id },
        data: { status: RetrainingJobStatus.ACCEPTED, providerJobId },
      });
      await this.audit.record({
        type: AuditEventType.RETRAINING_REQUESTED,
        actorUserId: actorUserId ?? null,
        metadata: { jobId: job.id, trigger: reason, datasetVersion },
      });
      return accepted;
    } catch (error) {
      await this.prisma.retrainingJob.update({
        where: { id: job.id },
        data: {
          status: RetrainingJobStatus.FAILED,
          detail: (error as Error).message.slice(0, 500),
        },
      });
      throw error;
    }
  }

  listJobs() {
    return this.prisma.retrainingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }

  listInvestigations() {
    return this.prisma.driftInvestigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Opens an investigation from the current signal. The evaluation is frozen
   * into `metrics` so the record keeps showing why it was opened.
   */
  async openInvestigation(actorUserId: string, notes?: string) {
    const [evaluation, active] = await Promise.all([
      this.evaluateTriggers(),
      this.prisma.modelVersion.findFirst({
        where: { isActive: true },
        select: { versionTag: true },
      }),
    ]);
    const signal = evaluation.triggered ? evaluation.reason : 'manual';
    const existing = await this.prisma.driftInvestigation.findFirst({
      where: { signal, status: { in: OPEN_STATES } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An investigation for this signal is already open.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const investigation = await tx.driftInvestigation.create({
        data: {
          signal,
          modelVersionTag: active?.versionTag ?? null,
          metrics: evaluation as unknown as Prisma.InputJsonObject,
          notes: notes?.trim() || null,
          openedByUserId: actorUserId,
        },
      });
      await this.audit.record(
        {
          type: AuditEventType.DRIFT_INVESTIGATION_OPENED,
          actorUserId,
          metadata: { investigationId: investigation.id, signal },
        },
        tx,
      );
      return investigation;
    });
  }

  async updateInvestigation(
    id: string,
    dto: UpdateDriftInvestigationDto,
    actorUserId: string,
  ) {
    const current = await this.prisma.driftInvestigation.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Investigation not found.');
    const closing =
      dto.status === DriftInvestigationStatus.RESOLVED ||
      dto.status === DriftInvestigationStatus.DISMISSED;
    if (dto.status && !NEXT_STATES[current.status].includes(dto.status)) {
      throw new ConflictException(
        `An investigation cannot move from ${current.status} to ${dto.status}.`,
      );
    }
    if (!dto.status && !OPEN_STATES.includes(current.status)) {
      throw new ConflictException('Closed investigations cannot be edited.');
    }
    if (closing && !dto.resolution?.trim()) {
      throw new BadRequestException(
        'Record the finding before resolving or dismissing an investigation.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.driftInvestigation.updateMany({
        where: { id, status: current.status },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes.trim() || null }
            : {}),
          ...(closing
            ? {
                resolution: dto.resolution!.trim(),
                resolvedByUserId: actorUserId,
                resolvedAt: new Date(),
              }
            : {}),
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          'This investigation changed. Reload and try again.',
        );
      }
      await this.audit.record(
        {
          type: AuditEventType.DRIFT_INVESTIGATION_UPDATED,
          actorUserId,
          metadata: {
            investigationId: id,
            from: current.status,
            to: dto.status ?? current.status,
          },
        },
        tx,
      );
      return tx.driftInvestigation.findUniqueOrThrow({ where: { id } });
    });
  }

  /** Requests retraining for an open investigation and links the job. */
  async retrainForInvestigation(id: string, actorUserId: string) {
    const current = await this.prisma.driftInvestigation.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Investigation not found.');
    if (!OPEN_STATES.includes(current.status)) {
      throw new ConflictException(
        'Retraining can only be requested from an open investigation.',
      );
    }
    const job = await this.triggerRetrain(current.signal, actorUserId);
    await this.prisma.driftInvestigation.update({
      where: { id },
      data: {
        retrainingJobId: job.id,
        status: DriftInvestigationStatus.INVESTIGATING,
      },
    });
    return job;
  }

  // Page-Hinkley test detecting a sustained upward shift in classification
  // uncertainty (lower scores indicate model is less confident → possible drift).
  // Returns true when accumulated deviation exceeds lambda.
  private pageHinkley(scores: number[]): boolean {
    if (scores.length < PH_MIN_SAMPLES) return false;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    let cumSum = 0;
    let minCumSum = Infinity;

    for (const x of scores) {
      // Decrease-detecting form: drift fires when score drops below running mean
      cumSum += mean - x - PH_DELTA;
      if (cumSum < minCumSum) minCumSum = cumSum;
      if (cumSum - minCumSum > PH_LAMBDA) return true;
    }

    return false;
  }

  private isEnabled(): boolean {
    return process.env.RETRAINING_ENABLED?.trim().toLowerCase() === 'true';
  }

  private async callRetrainEndpoint(
    reason: string,
    apiKey: string,
    datasetVersion: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`${this.aiServiceUrl}/retrain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          trigger: reason,
          dataset_version: datasetVersion,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          job_id?: unknown;
          dataset_version?: unknown;
        } | null;
        // An AI build that drops the field would queue an unreproducible
        // job while appearing to succeed; treat that as a rejection.
        if (payload?.dataset_version !== datasetVersion) {
          this.logger.error(
            'AI service accepted the retrain request without recording its dataset version.',
          );
          throw new ServiceUnavailableException(
            'The AI service did not record the dataset version for this job. Upgrade the AI service before retraining.',
          );
        }
        this.logger.log(`AI service accepted retrain request (${reason})`);
        return typeof payload.job_id === 'string' ? payload.job_id : null;
      }
      this.logger.error(
        `AI service rejected retrain request: HTTP ${res.status}`,
      );
      throw new ServiceUnavailableException(
        'AI service rejected the retraining request.',
      );
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `Could not reach AI service for retraining: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'AI service is unavailable for retraining.',
      );
    }
  }
}
