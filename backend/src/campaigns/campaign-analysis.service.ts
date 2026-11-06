import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AuditEventType,
  CampaignEvolutionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ANALYSIS_ALGORITHM_VERSION,
  AUTHORITATIVE_MATCH_SOURCES,
  analysisWindow,
  observe,
  proposeEvolution,
  sameObservation,
} from './campaign-analysis';

export const ANALYSIS_ORIGIN = 'ANALYSIS';
const SYSTEM_ACTOR = 'system';

type Window = ReturnType<typeof analysisWindow>;
type Outcome = 'created' | 'updated' | 'unchanged' | 'skipped';

export interface AnalysisRunSummary {
  algorithmVersion: string;
  windowStart: Date;
  windowEnd: Date;
  campaigns: number;
  observations: Record<Outcome, number>;
  proposals: number;
}

/**
 * Runs the deterministic window analysis in campaign-analysis.ts over stored
 * data and files its findings as DRAFT evolution events. Drafts never reach
 * Shield on their own: the existing approval step re-checks the summary and
 * the observation evidence, and an Admin must approve each one.
 */
@Injectable()
export class CampaignAnalysisService {
  private readonly logger = new Logger(CampaignAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Daily, after the UTC day closes, so the window is complete.
  @Cron('15 0 * * *', { timeZone: 'UTC' })
  async scheduledRun() {
    if (process.env.CAMPAIGN_ANALYSIS_ENABLED?.trim().toLowerCase() === 'false')
      return;
    try {
      const summary = await this.run({ actorUserId: null });
      this.logger.log(
        `Campaign analysis: ${summary.campaigns} campaigns, ${summary.proposals} proposals.`,
      );
    } catch (error) {
      this.logger.error(
        `Campaign analysis failed: ${(error as Error).message}`,
      );
    }
  }

  async run(options: {
    actorUserId: string | null;
    campaignId?: string;
    reference?: Date;
  }): Promise<AnalysisRunSummary> {
    const window = analysisWindow(options.reference ?? new Date());
    const campaigns = await this.prisma.campaignCluster.findMany({
      where: {
        archivedAt: null,
        ...(options.campaignId ? { id: options.campaignId } : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true, urlDomains: true },
    });
    if (options.campaignId && !campaigns.length) {
      throw new NotFoundException('Campaign not found or archived.');
    }

    const summary: AnalysisRunSummary = {
      algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
      windowStart: window.start,
      windowEnd: window.end,
      campaigns: campaigns.length,
      observations: { created: 0, updated: 0, unchanged: 0, skipped: 0 },
      proposals: 0,
    };
    for (const campaign of campaigns) {
      const outcome = await this.analyzeCampaign(
        campaign,
        window,
        options.actorUserId ?? SYSTEM_ACTOR,
      );
      summary.observations[outcome.observation] += 1;
      summary.proposals += outcome.proposals;
    }

    await this.audit.record({
      type: AuditEventType.CAMPAIGN_ANALYSIS_RUN,
      actorUserId: options.actorUserId,
      metadata: {
        algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        campaignId: options.campaignId ?? null,
        campaigns: summary.campaigns,
        observations: summary.observations,
        proposals: summary.proposals,
      },
    });
    return summary;
  }

  listObservations(campaignId: string) {
    return this.prisma.campaignObservation.findMany({
      where: { campaignId },
      orderBy: { windowEnd: 'desc' },
      take: 30,
    });
  }

  private async analyzeCampaign(
    campaign: { id: string; urlDomains: string[] },
    window: Window,
    actor: string,
  ): Promise<{ observation: Outcome; proposals: number }> {
    const authoritative = {
      clusterId: campaign.id,
      campaignMatchSource: { in: AUTHORITATIVE_MATCH_SOURCES },
    };
    const [messages, earlierCount, previousObservation] = await Promise.all([
      this.prisma.smsMessage.findMany({
        where: {
          ...authoritative,
          receivedAt: { gte: window.previousStart, lt: window.end },
        },
        orderBy: { id: 'asc' },
        select: { id: true, body: true, receivedAt: true },
      }),
      this.prisma.smsMessage.count({
        where: { ...authoritative, receivedAt: { lt: window.previousStart } },
      }),
      this.prisma.campaignObservation.findFirst({
        where: {
          campaignId: campaign.id,
          algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
          windowEnd: { lt: window.end },
        },
        orderBy: { windowEnd: 'desc' },
        select: { domains: true },
      }),
    ]);
    const current = messages.filter((m) => m.receivedAt >= window.start);
    const previous = messages.filter((m) => m.receivedAt < window.start);
    const result = observe({
      currentTexts: current.map((m) => m.body),
      currentMessageIds: current.map((m) => m.id),
      previousTexts: previous.map((m) => m.body),
      earlierCount,
      indicatorDomains: campaign.urlDomains,
      previousObservationDomains: previousObservation?.domains ?? null,
    });
    if (!result) return { observation: 'skipped', proposals: 0 };

    return this.prisma.$transaction(async (tx) => {
      const key = {
        campaignId: campaign.id,
        windowStart: window.start,
        windowEnd: window.end,
        algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
      };
      const existing = await tx.campaignObservation.findUnique({
        where: { campaignId_windowStart_windowEnd_algorithmVersion: key },
      });
      const data = {
        ...result,
        languageCounts:
          result.languageCounts as unknown as Prisma.InputJsonObject,
      };
      let outcome: Outcome;
      let observationId: string;
      if (existing && sameObservation(existing, result)) {
        outcome = 'unchanged';
        observationId = existing.id;
      } else if (existing) {
        // Inputs changed (for example a merge or correction moved messages).
        // Drafts built on the old numbers are withdrawn, never silently kept.
        await tx.campaignObservation.update({
          where: { id: existing.id },
          data,
        });
        await tx.campaignEvolutionEvent.updateMany({
          where: {
            observationId: existing.id,
            status: CampaignEvolutionStatus.DRAFT,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        outcome = 'updated';
        observationId = existing.id;
      } else {
        const created = await tx.campaignObservation.create({
          data: { ...key, ...data },
          select: { id: true },
        });
        outcome = 'created';
        observationId = created.id;
      }

      let proposals = 0;
      for (const proposal of proposeEvolution(result)) {
        const already = await tx.campaignEvolutionEvent.findFirst({
          where: { observationId, type: proposal.type, revokedAt: null },
          select: { id: true },
        });
        if (already) continue;
        await tx.campaignEvolutionEvent.create({
          data: {
            campaignId: campaign.id,
            type: proposal.type,
            summary: proposal.summary,
            evidenceReferences: [`observation:${observationId}`],
            createdByUserId: actor,
            origin: ANALYSIS_ORIGIN,
            observationId,
          },
        });
        proposals += 1;
      }
      return { observation: outcome, proposals };
    });
  }
}
