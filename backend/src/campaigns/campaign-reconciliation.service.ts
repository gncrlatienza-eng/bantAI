import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEventType,
  CampaignEvolutionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CorrectAssignmentDto,
  DraftEvolutionDto,
  MergeCampaignsDto,
  SplitCampaignDto,
} from './dto/reconcile-campaign.dto';
import { CampaignsService } from './campaigns.service';

const MAX_OPERATION_MESSAGES = 5000;

function assertSafeText(value: string): void {
  if (
    !value.trim() ||
    /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?63|0)9\d{9}|\b\d{4,}\b/i.test(
      value,
    )
  ) {
    throw new BadRequestException(
      'Use a privacy-safe explanation without URLs, email addresses, phone numbers or SMS content.',
    );
  }
}

@Injectable()
export class CampaignReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly campaigns: CampaignsService,
  ) {}

  listEvolution(campaignId: string) {
    return this.prisma.campaignEvolutionEvent.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        summary: true,
        evidenceReferences: true,
        status: true,
        origin: true,
        observationId: true,
        createdAt: true,
        approvedAt: true,
        revokedAt: true,
        approvedByUserId: true,
      },
    });
  }

  listAssignmentHistory(campaignId: string) {
    return this.prisma.campaignAssignmentHistory.findMany({
      where: {
        OR: [
          { previousCampaignId: campaignId },
          { nextCampaignId: campaignId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        messageId: true,
        operationId: true,
        previousCampaignId: true,
        nextCampaignId: true,
        previousMatchSource: true,
        actorUserId: true,
        reason: true,
        createdAt: true,
      },
    });
  }

  private async lockCampaigns(tx: Prisma.TransactionClient, ids: string[]) {
    const sorted = [...new Set(ids)].sort();
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CampaignCluster"
      WHERE id IN (${Prisma.join(sorted)})
      ORDER BY id FOR UPDATE
    `;
  }

  private async assertEvidence(
    tx: Prisma.TransactionClient,
    references: string[],
    campaignIds: string[],
    messageId?: string,
  ) {
    if (!references.length || references.length > 20) {
      throw new BadRequestException('Reviewed internal evidence is required.');
    }
    for (const reference of references) {
      const [kind, id] = reference.split(':');
      if (!/^[0-9a-f-]{36}$/i.test(id ?? '')) {
        throw new BadRequestException('Evidence reference is invalid.');
      }
      if (kind === 'report') {
        const report = await tx.userReport.findFirst({
          where: {
            id,
            status: 'Validated',
            message: {
              OR: [
                { clusterId: { in: campaignIds } },
                ...(messageId ? [{ id: messageId }] : []),
              ],
            },
          },
          select: { id: true },
        });
        if (report) continue;
      } else if (kind === 'operation') {
        const operation = await tx.campaignOperation.findFirst({
          where: {
            id,
            OR: [
              { targetCampaignId: { in: campaignIds } },
              { sourceIds: { hasSome: campaignIds } },
            ],
          },
          select: { id: true },
        });
        if (operation) continue;
      } else if (kind === 'observation') {
        const observation = await tx.campaignObservation.findFirst({
          where: { id, campaignId: { in: campaignIds } },
          select: { id: true },
        });
        if (observation) continue;
      }
      throw new BadRequestException(
        'Evidence must reference a validated report, a recorded campaign operation or a campaign observation.',
      );
    }
  }

  private async revokeSamples(
    tx: Prisma.TransactionClient,
    campaignIds: string[],
    now: Date,
  ) {
    await tx.shieldCampaignMessage.updateMany({
      where: { campaignId: { in: campaignIds }, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.campaignEvolutionEvent.updateMany({
      where: { campaignId: { in: campaignIds }, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async merge(targetId: string, dto: MergeCampaignsDto, actorUserId: string) {
    if (targetId === dto.sourceId) {
      throw new BadRequestException('Source and target must differ.');
    }
    assertSafeText(dto.reason);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockCampaigns(tx, [targetId, dto.sourceId]);
      const campaigns = await tx.campaignCluster.findMany({
        where: { id: { in: [targetId, dto.sourceId] } },
        select: {
          id: true,
          revision: true,
          archivedAt: true,
          urlDomains: true,
        },
      });
      const target = campaigns.find((row) => row.id === targetId);
      const source = campaigns.find((row) => row.id === dto.sourceId);
      if (!target || !source)
        throw new NotFoundException('Campaign not found.');
      if (target.archivedAt || source.archivedAt) {
        throw new BadRequestException('Archived campaigns cannot be merged.');
      }
      if (
        target.revision !== dto.expectedTargetRevision ||
        source.revision !== dto.expectedSourceRevision
      ) {
        throw new ConflictException('Campaign changed; reload before merging.');
      }
      await this.assertEvidence(tx, dto.evidenceReferences, [
        targetId,
        dto.sourceId,
      ]);
      const messages = await tx.smsMessage.findMany({
        where: { clusterId: dto.sourceId },
        take: MAX_OPERATION_MESSAGES + 1,
        select: { id: true, campaignMatchSource: true },
      });
      if (messages.length > MAX_OPERATION_MESSAGES) {
        throw new BadRequestException(
          'This merge needs a reviewed batch migration.',
        );
      }
      const now = new Date();
      const operation = await tx.campaignOperation.create({
        data: {
          kind: 'MERGE',
          sourceIds: [dto.sourceId],
          targetCampaignId: targetId,
          actorUserId,
          reason: dto.reason.trim(),
          evidenceReferences: dto.evidenceReferences,
        },
        select: { id: true },
      });
      if (messages.length) {
        await tx.campaignAssignmentHistory.createMany({
          data: messages.map((message) => ({
            messageId: message.id,
            operationId: operation.id,
            previousCampaignId: dto.sourceId,
            nextCampaignId: targetId,
            previousMatchSource: message.campaignMatchSource,
            actorUserId,
            reason: dto.reason.trim(),
          })),
        });
        const moved = await tx.smsMessage.updateMany({
          where: { clusterId: dto.sourceId },
          data: {
            clusterId: targetId,
            campaignMatchSource: 'admin_correction',
          },
        });
        if (moved.count !== messages.length) {
          throw new ConflictException(
            'Campaign messages changed during merge.',
          );
        }
      }
      await this.revokeSamples(tx, [targetId, dto.sourceId], now);
      await tx.campaignCluster.update({
        where: { id: targetId },
        data: {
          urlDomains: [
            ...new Set([...target.urlDomains, ...source.urlDomains]),
          ],
          centroid: Prisma.DbNull,
          isActive: false,
          publishedAt: null,
          countVerified: false,
          revision: { increment: 1 },
        },
      });
      await tx.campaignCluster.update({
        where: { id: dto.sourceId },
        data: {
          archivedAt: now,
          isActive: false,
          publishedAt: null,
          countVerified: false,
          revision: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_MERGED,
          actorUserId,
          metadata: {
            operationId: operation.id,
            sourceId: dto.sourceId,
            targetId,
            reassignedMessages: messages.length,
            countsRequireReview: true,
          },
        },
        tx,
      );
      return {
        operationId: operation.id,
        targetId,
        sourceId: dto.sourceId,
        reassignedMessages: messages.length,
      };
    });
    this.campaigns.invalidateDomainCache();
    return result;
  }

  async split(sourceId: string, dto: SplitCampaignDto, actorUserId: string) {
    assertSafeText(dto.reason);
    if (new Set(dto.messageIds).size !== dto.messageIds.length) {
      throw new BadRequestException('Message IDs must be unique.');
    }
    const domains = [...new Set(dto.domains.map((item) => item.toLowerCase()))];
    if (domains.some((item) => !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(item))) {
      throw new BadRequestException('Use valid domain indicators.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockCampaigns(tx, [sourceId]);
      const source = await tx.campaignCluster.findUnique({
        where: { id: sourceId },
        select: {
          id: true,
          revision: true,
          archivedAt: true,
          urlDomains: true,
        },
      });
      if (!source) throw new NotFoundException('Campaign not found.');
      if (source.archivedAt)
        throw new BadRequestException('Archived campaigns cannot be split.');
      if (source.revision !== dto.expectedRevision) {
        throw new ConflictException(
          'Campaign changed; reload before splitting.',
        );
      }
      if (domains.some((item) => !source.urlDomains.includes(item))) {
        throw new BadRequestException(
          'Split indicators must belong to the source campaign.',
        );
      }
      await this.assertEvidence(tx, dto.evidenceReferences, [sourceId]);
      const messages = await tx.smsMessage.findMany({
        where: { id: { in: dto.messageIds }, clusterId: sourceId },
        select: { id: true, campaignMatchSource: true },
      });
      if (messages.length !== dto.messageIds.length) {
        throw new ConflictException(
          'Some messages are no longer assigned to this campaign.',
        );
      }
      const child = await tx.campaignCluster.create({
        data: {
          label: dto.title.trim(),
          urlDomains: domains,
          isActive: false,
          centroid: Prisma.DbNull,
          publishedAt: null,
          messageCount: 0,
          countVerified: false,
        },
        select: { id: true },
      });
      const operation = await tx.campaignOperation.create({
        data: {
          kind: 'SPLIT',
          sourceIds: [sourceId],
          targetCampaignId: child.id,
          actorUserId,
          reason: dto.reason.trim(),
          evidenceReferences: dto.evidenceReferences,
        },
        select: { id: true },
      });
      await tx.campaignAssignmentHistory.createMany({
        data: messages.map((message) => ({
          messageId: message.id,
          operationId: operation.id,
          previousCampaignId: sourceId,
          nextCampaignId: child.id,
          previousMatchSource: message.campaignMatchSource,
          actorUserId,
          reason: dto.reason.trim(),
        })),
      });
      const moved = await tx.smsMessage.updateMany({
        where: { id: { in: dto.messageIds }, clusterId: sourceId },
        data: { clusterId: child.id, campaignMatchSource: 'admin_correction' },
      });
      if (moved.count !== messages.length) {
        throw new ConflictException('Campaign messages changed during split.');
      }
      await this.revokeSamples(tx, [sourceId], new Date());
      await tx.campaignCluster.update({
        where: { id: sourceId },
        data: {
          urlDomains: source.urlDomains.filter(
            (item) => !domains.includes(item),
          ),
          centroid: Prisma.DbNull,
          isActive: false,
          publishedAt: null,
          countVerified: false,
          revision: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_SPLIT,
          actorUserId,
          metadata: {
            operationId: operation.id,
            sourceId,
            childId: child.id,
            reassignedMessages: messages.length,
          },
        },
        tx,
      );
      return {
        operationId: operation.id,
        sourceId,
        childId: child.id,
        reassignedMessages: messages.length,
      };
    });
    this.campaigns.invalidateDomainCache();
    return result;
  }

  async correctAssignment(dto: CorrectAssignmentDto, actorUserId: string) {
    assertSafeText(dto.reason);
    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.smsMessage.findUnique({
        where: { id: dto.messageId },
        select: { id: true, clusterId: true, campaignMatchSource: true },
      });
      if (!message) throw new NotFoundException('Message not found.');
      const targetId = dto.targetCampaignId ?? null;
      if (message.clusterId === targetId) {
        throw new BadRequestException(
          'Message is already assigned to that campaign.',
        );
      }
      const ids = [message.clusterId, targetId].filter((id): id is string =>
        Boolean(id),
      );
      if (ids.length) await this.lockCampaigns(tx, ids);
      if (targetId) {
        const target = await tx.campaignCluster.findUnique({
          where: { id: targetId },
          select: { archivedAt: true },
        });
        if (!target) throw new NotFoundException('Target campaign not found.');
        if (target.archivedAt)
          throw new BadRequestException(
            'Archived campaigns cannot receive assignments.',
          );
      }
      await this.assertEvidence(tx, dto.evidenceReferences, ids, message.id);
      const operation = await tx.campaignOperation.create({
        data: {
          kind: 'CORRECTION',
          sourceIds: message.clusterId ? [message.clusterId] : [],
          targetCampaignId: targetId,
          actorUserId,
          reason: dto.reason.trim(),
          evidenceReferences: dto.evidenceReferences,
        },
        select: { id: true },
      });
      await tx.campaignAssignmentHistory.create({
        data: {
          messageId: message.id,
          operationId: operation.id,
          previousCampaignId: message.clusterId,
          nextCampaignId: targetId,
          previousMatchSource: message.campaignMatchSource,
          actorUserId,
          reason: dto.reason.trim(),
        },
      });
      const moved = await tx.smsMessage.updateMany({
        where: { id: message.id, clusterId: message.clusterId },
        data: {
          clusterId: targetId,
          campaignMatchSource: targetId ? 'admin_correction' : null,
        },
      });
      if (moved.count !== 1)
        throw new ConflictException(
          'Message assignment changed; reload and try again.',
        );
      if (ids.length) {
        await this.revokeSamples(tx, ids, new Date());
        await tx.campaignCluster.updateMany({
          where: { id: { in: ids } },
          data: {
            countVerified: false,
            centroid: Prisma.DbNull,
            isActive: false,
            publishedAt: null,
            revision: { increment: 1 },
          },
        });
      }
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_ASSIGNMENT_CORRECTED,
          actorUserId,
          metadata: {
            operationId: operation.id,
            messageId: message.id,
            from: message.clusterId,
            to: targetId,
          },
        },
        tx,
      );
      return {
        operationId: operation.id,
        messageId: message.id,
        campaignId: targetId,
      };
    });
    this.campaigns.invalidateDomainCache();
    return result;
  }

  async draftEvolution(
    campaignId: string,
    dto: DraftEvolutionDto,
    actorUserId: string,
  ) {
    assertSafeText(dto.summary);
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaignCluster.findUnique({
        where: { id: campaignId },
        select: { id: true, archivedAt: true },
      });
      if (!campaign) throw new NotFoundException('Campaign not found.');
      if (campaign.archivedAt)
        throw new BadRequestException(
          'Archived campaigns cannot publish evolution.',
        );
      await this.assertEvidence(tx, dto.evidenceReferences, [campaignId]);
      return tx.campaignEvolutionEvent.create({
        data: {
          campaignId,
          type: dto.type,
          summary: dto.summary.trim(),
          evidenceReferences: dto.evidenceReferences,
          createdByUserId: actorUserId,
        },
        select: { id: true, campaignId: true, status: true },
      });
    });
  }

  async approveEvolution(eventId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.campaignEvolutionEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          campaignId: true,
          status: true,
          revokedAt: true,
          summary: true,
          evidenceReferences: true,
          campaign: { select: { archivedAt: true } },
        },
      });
      if (!event) throw new NotFoundException('Evolution event not found.');
      if (event.status !== CampaignEvolutionStatus.DRAFT) {
        throw new ConflictException(
          'Evolution event has already been approved.',
        );
      }
      if (event.revokedAt) {
        throw new ConflictException(
          'Campaign evidence changed; create a new evolution event.',
        );
      }
      if (event.campaign.archivedAt) {
        throw new BadRequestException(
          'Archived campaign evolution cannot be published.',
        );
      }
      assertSafeText(event.summary);
      await this.assertEvidence(tx, event.evidenceReferences, [
        event.campaignId,
      ]);
      const now = new Date();
      const moved = await tx.campaignEvolutionEvent.updateMany({
        where: {
          id: eventId,
          status: CampaignEvolutionStatus.DRAFT,
          revokedAt: null,
        },
        data: {
          status: CampaignEvolutionStatus.APPROVED,
          approvedAt: now,
          approvedByUserId: actorUserId,
        },
      });
      if (moved.count !== 1)
        throw new ConflictException(
          'Evolution event changed; reload and try again.',
        );
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_EVOLUTION_APPROVED,
          actorUserId,
          metadata: {
            eventId,
            campaignId: event.campaignId,
            evidenceCount: event.evidenceReferences.length,
          },
        },
        tx,
      );
      return { eventId, campaignId: event.campaignId, approvedAt: now };
    });
  }
}
