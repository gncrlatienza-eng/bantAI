import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { maskSmsBody } from '../sms/sms-privacy-masker';
import { ApproveMaskedMessageDto } from './dto/approve-masked-message.dto';
import { CreateAdminCampaignDto } from './dto/create-admin-campaign.dto';
import {
  CAMPAIGN_PROFILE_VERSION,
  CreateClusterDto,
} from './dto/create-cluster.dto';
import { SetCampaignIndicatorsDto } from './dto/set-campaign-indicators.dto';
import { UpdateCampaignIntelligenceDto } from './dto/update-campaign-intelligence.dto';
import type {
  ShieldCampaignDto,
  ShieldMaskedMessageDto,
} from './dto/shield-campaign.dto';

const DOMAIN_CACHE_TTL_MS = 60_000;

@Injectable()
export class CampaignsService {
  private _domainCache: Set<string> | null = null;
  private _domainCacheExpiry = 0;

  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createAdmin(dto: CreateAdminCampaignDto, actorUserId: string) {
    const title = dto.title.trim();
    const summary = dto.summary.trim();
    const category = dto.category.trim();
    const mitigation = dto.mitigation.trim();
    if (!title || !summary || !category || !mitigation) {
      throw new BadRequestException(
        'Complete all campaign intelligence fields.',
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaignCluster.create({
        data: {
          label: title,
          summary,
          risk: dto.risk,
          category,
          mitigation,
          isActive: false,
          publishedAt: null,
          urlDomains: [],
        },
        select: { id: true, isActive: true, publishedAt: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_CREATED,
          actorUserId,
          metadata: { campaignId: campaign.id, source: 'ADMIN' },
        },
        tx,
      );
      return campaign;
    });
    return created;
  }

  async setIndicators(
    id: string,
    dto: SetCampaignIndicatorsDto,
    actorUserId: string,
  ) {
    const domains = Array.from(
      new Set(dto.domains.map((domain) => domain.toLowerCase())),
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.campaignCluster.findUnique({
        where: { id },
        select: { id: true, urlDomains: true, archivedAt: true },
      });
      if (!existing) throw new NotFoundException('Campaign not found');
      if (existing.archivedAt) {
        throw new BadRequestException('Archived campaigns cannot be edited.');
      }
      const result = await tx.campaignCluster.update({
        where: { id, archivedAt: null },
        data: { urlDomains: domains, publishedAt: null },
        select: { id: true, urlDomains: true, publishedAt: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_UPDATED,
          actorUserId,
          metadata: {
            campaignId: id,
            indicatorCountBefore: existing.urlDomains.length,
            indicatorCountAfter: domains.length,
            publicationReset: true,
          },
        },
        tx,
      );
      return result;
    });
    this.invalidateDomainCache();
    return updated;
  }

  async reactivate(id: string, actorUserId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.campaignCluster.findUnique({
        where: { id },
        select: {
          id: true,
          centroid: true,
          urlDomains: true,
          archivedAt: true,
        },
      });
      if (!existing) throw new NotFoundException('Campaign not found');
      if (existing.archivedAt) {
        throw new BadRequestException(
          'Archived campaigns cannot be reactivated.',
        );
      }
      if (!existing.centroid && existing.urlDomains.length === 0) {
        throw new BadRequestException(
          'Add an indicator or model centroid before reactivating this campaign.',
        );
      }
      const result = await tx.campaignCluster.update({
        where: { id, archivedAt: null },
        data: { isActive: true },
        select: { id: true, isActive: true, updatedAt: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_UPDATED,
          actorUserId,
          metadata: { campaignId: id, action: 'REACTIVATED' },
        },
        tx,
      );
      return result;
    });
    this.invalidateDomainCache();
    return updated;
  }

  async archive(id: string, actorUserId: string) {
    const archived = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.campaignCluster.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!existing) throw new NotFoundException('Campaign not found');
      if (existing.archivedAt) {
        throw new BadRequestException('Campaign is already archived.');
      }
      const result = await tx.campaignCluster.update({
        where: { id, archivedAt: null },
        data: {
          archivedAt: new Date(),
          isActive: false,
          publishedAt: null,
        },
        select: { id: true, archivedAt: true, isActive: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_UPDATED,
          actorUserId,
          metadata: {
            campaignId: id,
            action: 'ARCHIVED',
            publicationReset: true,
          },
        },
        tx,
      );
      return result;
    });
    this.invalidateDomainCache();
    return archived;
  }

  async updateIntelligence(
    id: string,
    dto: UpdateCampaignIntelligenceDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.campaignCluster.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!existing) throw new NotFoundException('Campaign not found');
      if (existing.archivedAt) {
        throw new BadRequestException('Archived campaigns cannot be edited.');
      }
      const updated = await tx.campaignCluster.update({
        where: { id, archivedAt: null },
        data: {
          // Material edits require another explicit publication review.
          publishedAt: null,
          ...(dto.title !== undefined ? { label: dto.title.trim() } : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
          ...(dto.risk !== undefined ? { risk: dto.risk } : {}),
          ...(dto.category !== undefined
            ? { category: dto.category.trim() }
            : {}),
          ...(dto.mitigation !== undefined
            ? { mitigation: dto.mitigation.trim() }
            : {}),
        },
        select: { id: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_UPDATED,
          actorUserId,
          metadata: { campaignId: id, publicationReset: true },
        },
        tx,
      );
      return updated;
    });
  }

  async publish(id: string, actorUserId: string): Promise<ShieldCampaignDto> {
    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaignCluster.findUnique({
        where: { id },
        select: {
          id: true,
          label: true,
          summary: true,
          risk: true,
          category: true,
          mitigation: true,
          archivedAt: true,
        },
      });
      if (!campaign) throw new NotFoundException('Campaign not found');
      if (campaign.archivedAt) {
        throw new BadRequestException(
          'Archived campaigns cannot be published.',
        );
      }
      if (
        !campaign.label?.trim() ||
        !campaign.summary?.trim() ||
        !campaign.risk?.trim() ||
        !campaign.category?.trim() ||
        !campaign.mitigation?.trim()
      ) {
        throw new BadRequestException(
          'Complete the title, summary, risk, category, and mitigation before publishing.',
        );
      }
      if (
        [
          campaign.label,
          campaign.summary,
          campaign.category,
          campaign.mitigation,
        ].some((value) => value && containsObviousPersonalData(value))
      ) {
        throw new BadRequestException(
          'Remove URLs, email addresses, phone/account numbers, and other identifiers before publishing.',
        );
      }
      await tx.campaignCluster.update({
        where: { id, archivedAt: null },
        data: { publishedAt: new Date() },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_PUBLISHED,
          actorUserId,
          metadata: { campaignId: id },
        },
        tx,
      );
    });
    return this.findShieldOne(id);
  }

  /** Published intelligence only. The select cannot pull SMS or model internals. */
  async findShieldAll(): Promise<ShieldCampaignDto[]> {
    const campaigns = await this.prisma.campaignCluster.findMany({
      where: { publishedAt: { not: null }, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: SHIELD_CAMPAIGN_SELECT,
    });
    return campaigns.map(toShieldCampaign);
  }

  async findShieldOne(id: string): Promise<ShieldCampaignDto> {
    const campaign = await this.prisma.campaignCluster.findFirst({
      where: { id, publishedAt: { not: null }, archivedAt: null },
      select: SHIELD_CAMPAIGN_SELECT,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return toShieldCampaign(campaign);
  }

  async findShieldIndicators(id: string) {
    const campaign = await this.findShieldOne(id);
    return {
      campaignId: campaign.id,
      domains: campaign.urlDomains,
      observedDomainCount: campaign.observedDomainCount,
    };
  }

  async findShieldTimeline(id: string) {
    await this.findShieldOne(id);
    const events = await this.prisma.campaignEvolutionEvent.findMany({
      where: {
        campaignId: id,
        status: 'APPROVED',
        approvedAt: { not: null },
        revokedAt: null,
      },
      orderBy: { approvedAt: 'asc' },
      select: { id: true, type: true, summary: true, approvedAt: true },
    });
    return {
      campaignId: id,
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        summary: event.summary,
        at: event.approvedAt,
      })),
    };
  }

  async findShieldMaskedMessages(
    id: string,
  ): Promise<ShieldMaskedMessageDto[]> {
    await this.findShieldOne(id);
    const records = await this.prisma.shieldCampaignMessage.findMany({
      where: {
        campaignId: id,
        approvedAt: { lte: new Date() },
        revokedAt: null,
        approvedByUserId: { not: null },
      },
      orderBy: { approvedAt: 'desc' },
      take: 100,
      select: {
        maskedText: true,
        language: true,
        classification: true,
        confidence: true,
      },
    });
    return records
      .filter((record) => isConservativelyMasked(record.maskedText))
      .map((record) => ({
        text: record.maskedText,
        language: record.language,
        classification: record.classification,
        confidence: record.confidence,
        campaignId: id,
      }));
  }

  async approveMaskedMessage(
    campaignId: string,
    dto: ApproveMaskedMessageDto,
    actorUserId: string,
  ): Promise<{ id: string; campaignId: string; approvedAt: Date }> {
    const maskedText = dto.text.trim();
    if (!isConservativelyMasked(maskedText)) {
      throw new BadRequestException(
        'Use reviewed placeholder text with no URLs, email addresses, phone numbers, or account numbers.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaignCluster.findUnique({
        where: { id: campaignId },
        select: { id: true, archivedAt: true },
      });
      if (!campaign) throw new NotFoundException('Campaign not found');
      if (campaign.archivedAt) {
        throw new BadRequestException('Archived campaigns cannot be edited.');
      }
      const record = await tx.shieldCampaignMessage.create({
        data: {
          campaignId,
          maskedText,
          language: dto.language?.trim() || null,
          classification: dto.classification || null,
          confidence: dto.confidence ?? null,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
        select: { id: true, campaignId: true, approvedAt: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.MASKED_MESSAGE_APPROVED,
          actorUserId,
          metadata: { campaignId, maskedMessageId: record.id },
        },
        tx,
      );
      return record;
    });
  }

  findAll() {
    return this.prisma.campaignCluster
      .findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { messageCount: 'desc' },
        select: {
          id: true,
          label: true,
          category: true,
          risk: true,
          summary: true,
          publishedAt: true,
          archivedAt: true,
          urlDomains: true,
          isActive: true,
          messageCount: true,
          countVerified: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .then(withoutDraftSummary);
  }

  async findOne(id: string, userId: string) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        category: true,
        urlDomains: true,
        isActive: true,
        messageCount: true,
        countVerified: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { userId },
          select: {
            id: true,
            // Sender and body are pseudonymized/masked at ingestion. Campaign
            // members from other users are never returned to a JWT user.
            body: true,
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
          orderBy: { receivedAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);
    return { ...cluster, messages: cluster.messages.map(withRemaskedBody) };
  }

  async findAdminOne(id: string, actorUserId: string) {
    const campaign = await this.prisma.campaignCluster.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        urlDomains: true,
        isActive: true,
        messageCount: true,
        countVerified: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        archivedAt: true,
        summary: true,
        risk: true,
        category: true,
        mitigation: true,
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            body: true,
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    // Only an actual disclosure of member messages is an access event.
    if (campaign.messages.length) {
      await this.audit.record({
        type: AuditEventType.RESTRICTED_MESSAGE_ACCESSED,
        actorUserId,
        metadata: {
          campaignId: id,
          source: 'admin-campaign-detail',
          count: campaign.messages.length,
        },
      });
    }
    return { ...campaign, messages: campaign.messages.map(withRemaskedBody) };
  }

  // Called by the AI/ML service to register a new campaign cluster.
  async create(data: CreateClusterDto) {
    const cluster = await this.prisma.campaignCluster.create({
      data: {
        label: data.label,
        category: data.category,
        centroid: data.centroid ?? undefined,
        urlDomains: data.urlDomains ?? [],
        lexicalProfile: data.lexical
          ? {
              version: data.lexical.version,
              shingles: [...new Set(data.lexical.shingles)].sort(),
              memberCount: data.lexical.memberCount,
            }
          : undefined,
      },
    });
    this.invalidateDomainCache();
    return cluster;
  }

  // Called by the AI/ML service to add newly discovered URL domains to a cluster.
  async addDomains(id: string, domains: string[]) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
    });
    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);
    if (cluster.archivedAt) {
      throw new BadRequestException(
        'Archived campaigns cannot receive indicators.',
      );
    }

    const merged = Array.from(new Set([...cluster.urlDomains, ...domains]));
    const updated = await this.prisma.campaignCluster.update({
      where: { id, archivedAt: null },
      // New machine-discovered indicators need human review before Shield sees them.
      data: { urlDomains: merged, publishedAt: null },
    });
    this.invalidateDomainCache();
    return updated;
  }

  async deactivate(id: string, actorUserId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const cluster = await tx.campaignCluster.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!cluster)
        throw new NotFoundException(`Campaign cluster ${id} not found`);
      const result = await tx.campaignCluster.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, isActive: true, updatedAt: true },
      });
      await this.audit.record(
        {
          type: AuditEventType.CAMPAIGN_DEACTIVATED,
          actorUserId: actorUserId ?? null,
          metadata: {
            campaignId: id,
            actor: actorUserId ? 'ADMIN' : 'AI_SERVICE',
          },
        },
        tx,
      );
      return result;
    });
    this.invalidateDomainCache();
    return updated;
  }

  // Used internally by SmsService during link suppression.
  // Finds an active cluster whose urlDomains overlap with the provided domains.
  findByDomains(domains: string[]) {
    if (domains.length === 0) return null;
    return this.prisma.campaignCluster.findFirst({
      where: {
        isActive: true,
        archivedAt: null,
        urlDomains: { hasSome: domains },
      },
      select: { id: true, label: true, category: true },
    });
  }

  // Resolves an AI-issued match against the backend's active registry. The
  // model may only refer to a cluster the backend currently owns and serves:
  // stale (a centroid cache on the AI side), fabricated, deactivated or
  // archived ids are discarded before persistence. label/category let the
  // phone group its own messages by campaign without another request.
  findActiveById(id: string) {
    return this.prisma.campaignCluster.findFirst({
      where: { id, isActive: true, archivedAt: null },
      select: { id: true, label: true, category: true },
    });
  }

  findAllInactive() {
    return this.prisma.campaignCluster
      .findMany({
        where: { isActive: false, archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          label: true,
          category: true,
          risk: true,
          summary: true,
          publishedAt: true,
          archivedAt: true,
          urlDomains: true,
          isActive: true,
          messageCount: true,
          countVerified: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .then(withoutDraftSummary);
  }

  findArchived() {
    return this.prisma.campaignCluster
      .findMany({
        where: { archivedAt: { not: null } },
        orderBy: { archivedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          label: true,
          category: true,
          risk: true,
          summary: true,
          publishedAt: true,
          urlDomains: true,
          isActive: true,
          messageCount: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          countVerified: true,
          revision: true,
        },
      })
      .then(withoutDraftSummary);
  }

  /**
   * Internal: the AI service's matcher set (audit 2026-09-30, finding 5).
   * Each item carries everything the three match tiers need: the centroid
   * (embedding tier), the reviewed urlDomains (domain tier), and the stored
   * wording profile (hybrid tier), under an explicit profileVersion. Domains
   * come from the Admin-reviewed indicator list, never from the profile.
   */
  async findAllCentroids() {
    const clusters = await this.prisma.campaignCluster.findMany({
      where: { isActive: true, archivedAt: null },
      select: {
        id: true,
        centroid: true,
        label: true,
        urlDomains: true,
        lexicalProfile: true,
      },
    });
    return clusters.map(({ lexicalProfile, urlDomains, ...cluster }) => {
      const profile = readLexicalProfile(lexicalProfile);
      return {
        ...cluster,
        urlDomains,
        profileVersion: CAMPAIGN_PROFILE_VERSION,
        lexical: {
          shingles: profile?.shingles ?? [],
          domains: urlDomains,
          member_count: profile?.memberCount ?? 0,
        },
      };
    });
  }

  incrementMessageCount(id: string) {
    return this.prisma.campaignCluster.update({
      where: { id },
      data: { messageCount: { increment: 1 } },
    });
  }

  // Returns a flat Set of all URL domains across active clusters.
  // Used by SmsService for O(1) domain lookups during link suppression.
  // Cached for 60 s to avoid a full table scan on every SMS ingest.
  async getActiveDomains(): Promise<Set<string>> {
    if (this._domainCache && Date.now() < this._domainCacheExpiry) {
      return this._domainCache;
    }
    const clusters = await this.prisma.campaignCluster.findMany({
      where: { isActive: true, archivedAt: null },
      select: { urlDomains: true },
    });
    const domains = clusters.flatMap((c) => c.urlDomains);
    this._domainCache = new Set(domains);
    this._domainCacheExpiry = Date.now() + DOMAIN_CACHE_TTL_MS;
    return this._domainCache;
  }

  // Call after creating or deactivating a cluster so the next ingest sees fresh domains.
  invalidateDomainCache(): void {
    this._domainCache = null;
    this._domainCacheExpiry = 0;
  }
}

// Publication review is required, and these obvious identifiers are rejected
// again at read time. Ambiguous samples must be withheld, not guessed at.
function containsObviousPersonalData(text: string): boolean {
  return (
    /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) ||
    /(?:\+?63|0)9[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d[\s().-]*\d/.test(
      text,
    ) ||
    /\b\d(?:[\s-]*\d){3,}\b/.test(text)
  );
}

/** A stored profile in the current contract version, or null. */
function readLexicalProfile(
  value: unknown,
): { shingles: string[]; memberCount: number } | null {
  const profile = value as {
    version?: unknown;
    shingles?: unknown;
    memberCount?: unknown;
  } | null;
  if (
    !profile ||
    profile.version !== CAMPAIGN_PROFILE_VERSION ||
    !Array.isArray(profile.shingles)
  ) {
    return null;
  }
  return {
    shingles: profile.shingles.filter(
      (shingle): shingle is string => typeof shingle === 'string',
    ),
    memberCount:
      typeof profile.memberCount === 'number' ? profile.memberCount : 0,
  };
}

// Rows stored before server-side ingest masking may hold a client's unmasked
// body; reads always return the canonical masked form.
function withRemaskedBody<T extends { body: string }>(message: T): T {
  return { ...message, body: maskSmsBody(message.body) };
}

function isConservativelyMasked(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= 2000 &&
    /\[(?:NAME|BRAND|ACCOUNT|URL|PHONE|OTP|EMAIL|ADDRESS)\]/.test(text) &&
    !containsObviousPersonalData(text)
  );
}

const SHIELD_CAMPAIGN_SELECT = {
  id: true,
  label: true,
  risk: true,
  category: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  summary: true,
  mitigation: true,
  urlDomains: true,
} as const;

function toShieldCampaign(campaign: {
  id: string;
  label: string | null;
  risk: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  summary: string | null;
  mitigation: string | null;
  urlDomains: string[];
}): ShieldCampaignDto {
  return {
    id: campaign.id,
    title: campaign.label ?? 'Untitled campaign',
    label: campaign.label ?? 'Untitled campaign',
    risk: campaign.risk ?? 'UNKNOWN',
    category: campaign.category ?? 'Uncategorized',
    status: campaign.isActive ? 'ACTIVE' : 'DORMANT',
    isActive: campaign.isActive,
    firstObserved: campaign.createdAt,
    createdAt: campaign.createdAt,
    lastObserved: campaign.updatedAt,
    updatedAt: campaign.updatedAt,
    summary: campaign.summary ?? '',
    mitigation: campaign.mitigation ?? '',
    observedDomainCount: campaign.urlDomains.length,
    urlDomains: campaign.urlDomains
      .filter((domain) => /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain))
      .map((domain) => domain.replaceAll('.', '[.]')),
  };
}

// The shared lists also reach mobile JWTs (GET /campaigns); a reviewer's
// draft summary is only shown once the campaign is published.
function withoutDraftSummary<
  T extends { summary: string | null; publishedAt: Date | null },
>(campaigns: T[]): T[] {
  return campaigns.map((campaign) =>
    campaign.publishedAt ? campaign : { ...campaign, summary: null },
  );
}
