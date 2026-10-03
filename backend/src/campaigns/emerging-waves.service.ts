import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditEventType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { groupUnmatched } from './emerging-waves';

/** CampaignCluster.origin for waves found here rather than by offline clustering. */
export const EMERGING_ORIGIN = 'EMERGING';
/** SmsMessage.campaignMatchSource for texts linked by this grouping. */
export const EMERGING_MATCH_SOURCE = 'emerging';

// Only recent texts can start or join a wave; older unmatched ones are
// history, not an ongoing blast.
const WINDOW_DAYS = 90;
// Members per existing wave compared against; plenty to recognise a blast.
const MEMBERS_PER_WAVE = 20;
// Grouping is pairwise and runs on the API's event loop, so one run looks at
// the newest texts only; anything older is picked up by later runs as these
// get linked. Keeps a run to well under a second.
const MAX_CANDIDATES = 1500;
// Coalesces a burst of scam ingests into one run.
const DEBOUNCE_MS = 5_000;

export interface EmergingRunSummary {
  candidates: number;
  attached: number;
  newWaves: number;
}

/**
 * Turns scam texts that matched no known campaign into campaigns, so a new
 * blast reaches the admin dashboard the way it already shows on the phone
 * (see emerging-waves.ts).
 *
 * Waves found here are internal drafts: unpublished (Shield never sees them
 * until an Admin publishes), unrated, and they never advance the global
 * server-model messageCount or campaign analysis, because their texts may
 * carry device-fallback labels. They have no centroid, so the AI matcher
 * skips them; new texts join them on the next run instead.
 */
@Injectable()
export class EmergingWavesService implements OnModuleDestroy {
  private readonly logger = new Logger(EmergingWavesService.name);
  private running: Promise<EmergingRunSummary> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  /** After a scam text was stored with no campaign: group soon, off the request path. */
  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run().catch((error: unknown) =>
        this.logger.warn(`Emerging-wave grouping failed: ${String(error)}`),
      );
    }, DEBOUNCE_MS);
    this.timer.unref?.();
  }

  // Safety net for texts whose scheduled run was lost (restart, failure).
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledRun() {
    try {
      await this.run();
    } catch (error) {
      this.logger.warn(`Emerging-wave grouping failed: ${String(error)}`);
    }
  }

  /** One run at a time; a call during a run waits for that run. */
  run(actorUserId: string | null = null): Promise<EmergingRunSummary> {
    if (!this.running) {
      this.running = this.runOnce(actorUserId).finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async runOnce(
    actorUserId: string | null,
  ): Promise<EmergingRunSummary> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.smsMessage.findMany({
      where: {
        clusterId: null,
        receivedAt: { gte: since },
        classification: { is: { label: 'Scam' } },
      },
      select: { id: true, body: true },
      orderBy: { receivedAt: 'desc' },
      take: MAX_CANDIDATES,
    });
    if (candidates.length === 0) {
      return { candidates: 0, attached: 0, newWaves: 0 };
    }

    const waves = await this.prisma.campaignCluster.findMany({
      // Only waves still arriving can be joined; older ones are history and
      // would make every run slower as they pile up.
      where: {
        origin: EMERGING_ORIGIN,
        archivedAt: null,
        messages: { some: { receivedAt: { gte: since } } },
      },
      select: {
        id: true,
        messages: {
          select: { id: true, body: true },
          orderBy: { receivedAt: 'desc' },
          take: MEMBERS_PER_WAVE,
        },
      },
    });

    const { attachments, newWaves } = groupUnmatched(
      candidates,
      waves.map((w) => ({ id: w.id, members: w.messages })),
    );

    let attached = 0;
    for (const [waveId, ids] of attachments) {
      attached += await this.link(waveId, ids);
    }

    const created: string[] = [];
    for (const wave of newWaves) {
      const id = await this.prisma.$transaction(async (tx) => {
        const cluster = await tx.campaignCluster.create({
          data: {
            label: wave.label,
            category: wave.category,
            origin: EMERGING_ORIGIN,
            urlDomains: [],
            isActive: true,
          },
          select: { id: true },
        });
        // clusterId: null guards against a concurrent ingest or admin
        // correction that linked one of these texts meanwhile.
        const linked = await tx.smsMessage.updateMany({
          where: { id: { in: wave.memberIds }, clusterId: null },
          data: {
            clusterId: cluster.id,
            campaignMatchSource: EMERGING_MATCH_SOURCE,
          },
        });
        if (linked.count === 0) {
          await tx.campaignCluster.delete({ where: { id: cluster.id } });
          return null;
        }
        await this.audit.record(
          {
            type: AuditEventType.CAMPAIGN_UPDATED,
            actorUserId,
            metadata: {
              campaignId: cluster.id,
              action: 'EMERGING_WAVE_CREATED',
              reason: wave.reason,
              linkedMessages: linked.count,
            },
          },
          tx,
        );
        return cluster.id;
      });
      if (id) created.push(id);
    }

    if (attached || created.length) {
      this.logger.log(
        `Emerging waves: ${created.length} new, ${attached} texts joined existing waves.`,
      );
    }
    return {
      candidates: candidates.length,
      attached,
      newWaves: created.length,
    };
  }

  private async link(waveId: string, ids: string[]): Promise<number> {
    const linked = await this.prisma.smsMessage.updateMany({
      where: { id: { in: ids }, clusterId: null },
      data: { clusterId: waveId, campaignMatchSource: EMERGING_MATCH_SOURCE },
    });
    return linked.count;
  }
}
