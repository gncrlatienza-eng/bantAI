import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service';

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

@Injectable()
export class RetrainingService {
  private readonly logger = new Logger(RetrainingService.name);
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8001';
  private _retrainInFlight = false;

  constructor(private prisma: PrismaService) {}

  // Runs every hour. Evaluates all trigger conditions and calls the AI
  // service's /retrain endpoint if any condition is met.
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndTrigger() {
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
    await this.triggerRetrain(result.reason);
  }

  // Exposed so the manual trigger endpoint (Sprint 5, 5.3.4) can call it.
  async evaluateTriggers(): Promise<{
    triggered: boolean;
    reason: string;
    validatedCount: number;
    currentF1: number | null;
    drift: boolean;
  }> {
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

    // Condition 3: Page-Hinkley drift on recent classification scores
    const recentScores = await this.prisma.classification.findMany({
      where: { createdAt: { gte: lastPromotedAt } },
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

  async triggerRetrain(reason: string) {
    if (this._retrainInFlight) {
      throw new ConflictException('A retraining job is already in progress.');
    }
    this._retrainInFlight = true;
    this.logger.warn(`Retraining triggered: ${reason}`);
    try {
      await this.callRetrainEndpoint(reason);
    } finally {
      this._retrainInFlight = false;
    }
  }

  // Page-Hinkley test detecting a sustained upward shift in classification
  // uncertainty (lower scores indicate model is less confident → possible drift).
  // Returns true when accumulated deviation exceeds lambda.
  private pageHinkley(scores: number[]): boolean {
    if (scores.length < 100) return false;

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

  private async callRetrainEndpoint(reason: string) {
    try {
      const res = await fetch(`${this.aiServiceUrl}/retrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: reason }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        this.logger.log(`AI service accepted retrain request (${reason})`);
      } else {
        this.logger.error(
          `AI service rejected retrain request: HTTP ${res.status}`,
        );
      }
    } catch (err) {
      // Non-fatal: AI service may not have the /retrain endpoint yet.
      // The trigger conditions are still evaluated and logged.
      this.logger.warn(
        `Could not reach AI service for retraining: ${(err as Error).message}`,
      );
    }
  }
}
