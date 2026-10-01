import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AccessRequestStatus,
  AuditEventType,
  CampaignEvolutionStatus,
  DriftInvestigationStatus,
  LicenseStatus,
  ModelCandidateStatus,
  NotificationAudience,
  RetrainingJobStatus,
  ShieldReviewDecision,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ModelsService } from '../models/models.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

// Email and export-ready settings are not exposed: nothing delivers them yet.
const PREFERENCE_SELECT = {
  inAppEnabled: true,
  campaignChangesEnabled: true,
  subscriptionUpdatesEnabled: true,
  apiUsageAlertsEnabled: true,
  systemHealthAlertsEnabled: true,
  updatedAt: true,
} as const;

const INBOX_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} as const;

// Categories that have a real event source. Email and export preferences are
// stored for forward compatibility but nothing delivers them yet, so the
// portal does not offer them as working settings.
type Category =
  | 'campaignChangesEnabled'
  | 'subscriptionUpdatesEnabled'
  | 'apiUsageAlertsEnabled'
  | 'systemHealthAlertsEnabled';

type Preferences = Record<Category | 'inAppEnabled', boolean>;

export interface NotificationCandidate {
  category: Category;
  sourceKey: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  occurredAt: Date;
}

const LICENSE_EXPIRY_WARNING_DAYS = 14;
const SOURCE_LIMIT = 25;
const HEALTH_CACHE_MS = 60_000;

const SHIELD_SUBSCRIPTION_EVENTS: Partial<Record<AuditEventType, string>> = {
  [AuditEventType.LICENSE_ACTIVATED]: 'Your Shield subscription is active.',
  [AuditEventType.LICENSE_EXPIRED]:
    'Your Shield subscription has expired. Campaign intelligence and API access are paused.',
  [AuditEventType.LICENSE_SUSPENDED]:
    'Your Shield subscription is suspended. Contact the BantAI administrator.',
  [AuditEventType.LICENSE_SHIELD_REVIEWED]:
    'An administrator recorded a decision on your historical contract review.',
  [AuditEventType.MEMBER_ADDED]: 'A member was added to your organization.',
  [AuditEventType.MEMBER_REMOVED]:
    'A member was removed from your organization.',
};

const SHIELD_API_EVENTS: Partial<Record<AuditEventType, string>> = {
  [AuditEventType.API_KEY_CREATED]: 'A new Shield API key was created.',
  [AuditEventType.API_KEY_REVOKED]: 'A Shield API key was revoked.',
  [AuditEventType.API_KEY_ROTATED]: 'A Shield API key was rotated.',
  [AuditEventType.API_LIMITS_CHANGED]:
    'An administrator changed your API quota or rate limit.',
};

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

@Injectable()
export class PortalNotificationsService {
  private healthCache: {
    at: number;
    status: Awaited<ReturnType<ModelsService['getServingStatus']>>;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelsService,
  ) {}

  preferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: PREFERENCE_SELECT,
    });
  }

  updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: PREFERENCE_SELECT,
    });
  }

  async inbox(userId: string, audience: NotificationAudience) {
    await this.syncSystemEvents(userId, audience);
    const [items, unreadCount] = await Promise.all([
      this.prisma.portalNotification.findMany({
        where: { userId, audience },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: INBOX_SELECT,
      }),
      this.prisma.portalNotification.count({
        where: { userId, audience, readAt: null },
      }),
    ]);
    return { unreadCount, items };
  }

  async markRead(userId: string, audience: NotificationAudience, id: string) {
    const updated = await this.prisma.portalNotification.updateMany({
      where: { id, userId, audience },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1)
      throw new NotFoundException('Notification not found.');
    return this.prisma.portalNotification.findUniqueOrThrow({
      where: { id },
      select: INBOX_SELECT,
    });
  }

  async markAllRead(userId: string, audience: NotificationAudience) {
    await this.prisma.portalNotification.updateMany({
      where: { userId, audience, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: true };
  }

  /**
   * Materialises notices from verified system records. Shield recipients only
   * see published intelligence and events scoped to their own organizations;
   * Admin review queues, audit events and runtime health stay in the Admin
   * audience. Each (user, sourceKey) pair is stored once, so re-syncing never
   * duplicates a notice or resurrects one the user already read.
   */
  async syncSystemEvents(userId: string, audience: NotificationAudience) {
    const preferences = await this.preferences(userId);
    if (!preferences.inAppEnabled) return;
    const candidates =
      audience === NotificationAudience.SHIELD
        ? await this.shieldCandidates(userId, preferences)
        : await this.adminCandidates(preferences);
    if (!candidates.length) return;
    await this.prisma.portalNotification.createMany({
      data: candidates.map((candidate) => ({
        userId,
        audience,
        sourceKey: candidate.sourceKey,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        link: candidate.link,
        createdAt: candidate.occurredAt,
      })),
      skipDuplicates: true,
    });
  }

  async shieldCandidates(
    userId: string,
    preferences: Preferences,
    now = new Date(),
  ): Promise<NotificationCandidate[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const organizationIds = memberships.map((m) => m.organizationId);
    const candidates: NotificationCandidate[] = [];

    if (preferences.campaignChangesEnabled) {
      const [published, evolution] = await Promise.all([
        this.prisma.campaignCluster.findMany({
          where: { publishedAt: { not: null }, archivedAt: null },
          orderBy: { publishedAt: 'desc' },
          take: SOURCE_LIMIT,
          select: { id: true, label: true, risk: true, publishedAt: true },
        }),
        this.prisma.campaignEvolutionEvent.findMany({
          where: {
            status: CampaignEvolutionStatus.APPROVED,
            revokedAt: null,
            campaign: { publishedAt: { not: null }, archivedAt: null },
          },
          orderBy: { approvedAt: 'desc' },
          take: SOURCE_LIMIT,
          select: {
            id: true,
            summary: true,
            approvedAt: true,
            campaign: { select: { id: true, label: true } },
          },
        }),
      ]);
      for (const campaign of published) {
        candidates.push({
          category: 'campaignChangesEnabled',
          sourceKey: `campaign-published:${campaign.id}:${campaign.publishedAt!.toISOString()}`,
          type: 'CAMPAIGN_PUBLISHED',
          title: 'Campaign intelligence published',
          body: `${campaign.label || 'A campaign'}${campaign.risk ? ` (${campaign.risk.toLowerCase()} risk)` : ''} is available to review.`,
          link: `/shield/campaigns/${campaign.id}`,
          occurredAt: campaign.publishedAt!,
        });
      }
      for (const event of evolution) {
        candidates.push({
          category: 'campaignChangesEnabled',
          sourceKey: `campaign-evolution:${event.id}`,
          type: 'CAMPAIGN_EVOLUTION',
          title: `${event.campaign.label || 'Campaign'} changed`,
          body: event.summary,
          link: `/shield/campaigns/${event.campaign.id}`,
          occurredAt: event.approvedAt!,
        });
      }
    }

    if (!organizationIds.length) return candidates;

    const scopedAuditTypes = [
      ...(preferences.subscriptionUpdatesEnabled
        ? Object.keys(SHIELD_SUBSCRIPTION_EVENTS)
        : []),
      ...(preferences.apiUsageAlertsEnabled
        ? Object.keys(SHIELD_API_EVENTS)
        : []),
    ] as AuditEventType[];
    if (scopedAuditTypes.length) {
      const events = await this.prisma.auditEvent.findMany({
        where: {
          type: { in: scopedAuditTypes },
          organizationId: { in: organizationIds },
        },
        orderBy: { createdAt: 'desc' },
        take: SOURCE_LIMIT * 2,
        select: { id: true, type: true, createdAt: true },
      });
      for (const event of events) {
        const subscription = SHIELD_SUBSCRIPTION_EVENTS[event.type];
        candidates.push({
          category: subscription
            ? 'subscriptionUpdatesEnabled'
            : 'apiUsageAlertsEnabled',
          sourceKey: `audit:${event.id}`,
          type: event.type,
          title: subscription ? 'Subscription update' : 'API access update',
          body: subscription ?? SHIELD_API_EVENTS[event.type]!,
          link: subscription ? '/account' : '/shield/api',
          occurredAt: event.createdAt,
        });
      }
    }

    if (preferences.subscriptionUpdatesEnabled) {
      const warnBefore = new Date(
        now.getTime() + LICENSE_EXPIRY_WARNING_DAYS * 86_400_000,
      );
      const expiring = await this.prisma.license.findMany({
        where: {
          organizationId: { in: organizationIds },
          status: LicenseStatus.ACTIVE,
          validUntil: { gt: now, lte: warnBefore },
        },
        select: { id: true, validUntil: true },
      });
      for (const license of expiring) {
        const days = Math.max(
          1,
          Math.ceil(
            (license.validUntil!.getTime() - now.getTime()) / 86_400_000,
          ),
        );
        candidates.push({
          category: 'subscriptionUpdatesEnabled',
          sourceKey: `license-expiring:${license.id}:${license.validUntil!.toISOString()}`,
          type: 'LICENSE_EXPIRING',
          title: 'Subscription renewal due',
          body: `Your Shield subscription ends in ${days} day${days === 1 ? '' : 's'}. Renew to keep campaign intelligence and API access.`,
          link: '/account',
          occurredAt: now,
        });
      }
    }

    if (preferences.apiUsageAlertsEnabled) {
      candidates.push(
        ...(await this.quotaCandidates(organizationIds, now, '/shield/api')),
      );
    }
    return candidates;
  }

  async adminCandidates(
    preferences: Preferences,
    now = new Date(),
  ): Promise<NotificationCandidate[]> {
    const candidates: NotificationCandidate[] = [];

    if (preferences.campaignChangesEnabled) {
      const drafts = await this.prisma.campaignEvolutionEvent.findMany({
        where: { status: CampaignEvolutionStatus.DRAFT, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: SOURCE_LIMIT,
        select: {
          id: true,
          type: true,
          origin: true,
          createdAt: true,
          campaign: { select: { id: true, label: true } },
        },
      });
      for (const draft of drafts) {
        const change = draft.type.toLowerCase().replaceAll('_', ' ');
        candidates.push({
          category: 'campaignChangesEnabled',
          sourceKey: `evolution-draft:${draft.id}`,
          type: 'EVOLUTION_REVIEW',
          title:
            draft.origin === 'ANALYSIS'
              ? 'Proposed campaign change needs review'
              : 'Campaign evolution draft needs approval',
          body: `${draft.campaign.label || 'A campaign'} has an unapproved ${change} entry. Shield will not see it until an Admin approves it.`,
          link: `/admin/campaigns/${draft.campaign.id}`,
          occurredAt: draft.createdAt,
        });
      }
    }

    if (preferences.subscriptionUpdatesEnabled) {
      const [applications, contracts, licenseEvents] = await Promise.all([
        this.prisma.accessRequest.findMany({
          where: { status: AccessRequestStatus.RECEIVED },
          orderBy: { createdAt: 'desc' },
          take: SOURCE_LIMIT,
          select: { id: true, organization: true, createdAt: true },
        }),
        this.prisma.license.findMany({
          where: {
            legacyTier: { not: null },
            shieldReviewDecision: ShieldReviewDecision.PENDING,
          },
          take: SOURCE_LIMIT,
          select: { id: true, createdAt: true },
        }),
        this.prisma.auditEvent.findMany({
          where: {
            type: {
              in: [
                AuditEventType.LICENSE_EXPIRED,
                AuditEventType.LICENSE_SUSPENDED,
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: SOURCE_LIMIT,
          select: { id: true, type: true, createdAt: true },
        }),
      ]);
      for (const application of applications) {
        candidates.push({
          category: 'subscriptionUpdatesEnabled',
          sourceKey: `access-request:${application.id}`,
          type: 'APPLICATION_RECEIVED',
          title: 'New Shield application',
          body: `${application.organization} applied for Shield access.`,
          link: '/admin/access-requests',
          occurredAt: application.createdAt,
        });
      }
      for (const license of contracts) {
        candidates.push({
          category: 'subscriptionUpdatesEnabled',
          sourceKey: `contract-review:${license.id}`,
          type: 'CONTRACT_REVIEW',
          title: 'Historical contract awaits review',
          body: 'Shield access stays off for this license until an Admin records a contract decision.',
          link: '/admin/users',
          occurredAt: license.createdAt,
        });
      }
      for (const event of licenseEvents) {
        candidates.push({
          category: 'subscriptionUpdatesEnabled',
          sourceKey: `audit:${event.id}`,
          type: event.type,
          title:
            event.type === AuditEventType.LICENSE_EXPIRED
              ? 'A license expired'
              : 'A license was suspended',
          body: 'Shield access for the affected organization is paused.',
          link: '/admin/audit',
          occurredAt: event.createdAt,
        });
      }
    }

    if (preferences.apiUsageAlertsEnabled) {
      const organizations = await this.prisma.portalOrganization.findMany({
        where: { isActive: true, shieldApiKeys: { some: {} } },
        select: { id: true },
        take: 200,
      });
      candidates.push(
        ...(
          await this.quotaCandidates(
            organizations.map((o) => o.id),
            now,
            '/admin/shield-api',
          )
        ).filter((candidate) => candidate.type === 'API_QUOTA_REACHED'),
      );
    }

    if (preferences.systemHealthAlertsEnabled) {
      const [serving, candidatesAwaiting, failedJobs, openDrift] =
        await Promise.all([
          this.servingStatus(),
          this.prisma.modelVersion.findMany({
            where: {
              status: {
                in: [
                  ModelCandidateStatus.REGISTERED,
                  ModelCandidateStatus.EVALUATING,
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: SOURCE_LIMIT,
            select: { id: true, versionTag: true, createdAt: true },
          }),
          this.prisma.retrainingJob.findMany({
            where: { status: RetrainingJobStatus.FAILED },
            orderBy: { updatedAt: 'desc' },
            take: SOURCE_LIMIT,
            select: { id: true, trigger: true, updatedAt: true },
          }),
          this.prisma.driftInvestigation.findMany({
            where: {
              status: {
                in: [
                  DriftInvestigationStatus.OPEN,
                  DriftInvestigationStatus.INVESTIGATING,
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: SOURCE_LIMIT,
            select: { id: true, signal: true, createdAt: true },
          }),
        ]);
      const day = now.toISOString().slice(0, 10);
      if (serving.status !== 'ready') {
        candidates.push({
          category: 'systemHealthAlertsEnabled',
          sourceKey: `system-health:${serving.status}:${day}`,
          type: 'AI_SERVICE_UNHEALTHY',
          title:
            serving.status === 'unavailable'
              ? 'AI service unreachable'
              : 'AI model not ready',
          body: 'Classification requests cannot be served until the AI service reports a ready, approved model.',
          link: '/admin/model',
          occurredAt: now,
        });
      } else if (!serving.matchesRegistry) {
        candidates.push({
          category: 'systemHealthAlertsEnabled',
          sourceKey: `system-health:mismatch:${serving.versionTag ?? 'none'}:${day}`,
          type: 'MODEL_REGISTRY_MISMATCH',
          title: 'Serving model differs from the registry',
          body: `The AI service is serving ${serving.versionTag ?? 'an unregistered model'}, which is not the active registry version.`,
          link: '/admin/model',
          occurredAt: now,
        });
      }
      for (const model of candidatesAwaiting) {
        candidates.push({
          category: 'systemHealthAlertsEnabled',
          sourceKey: `model-candidate:${model.id}`,
          type: 'MODEL_CANDIDATE_REGISTERED',
          title: 'Model candidate awaits review',
          body: `${model.versionTag} was registered and needs an approval or rejection decision.`,
          link: '/admin/model',
          occurredAt: model.createdAt,
        });
      }
      for (const job of failedJobs) {
        candidates.push({
          category: 'systemHealthAlertsEnabled',
          sourceKey: `retraining-failed:${job.id}`,
          type: 'RETRAINING_FAILED',
          title: 'Retraining request failed',
          body: `The ${job.trigger.replaceAll('_', ' ')} retraining request was not accepted by the AI service.`,
          link: '/admin/model?tab=drift',
          occurredAt: job.updatedAt,
        });
      }
      for (const investigation of openDrift) {
        candidates.push({
          category: 'systemHealthAlertsEnabled',
          sourceKey: `drift-open:${investigation.id}`,
          type: 'DRIFT_INVESTIGATION_OPEN',
          title: 'Drift investigation open',
          body: `A ${investigation.signal.replaceAll('_', ' ')} signal is under investigation.`,
          link: '/admin/model?tab=drift',
          occurredAt: investigation.createdAt,
        });
      }
    }
    return candidates;
  }

  private async quotaCandidates(
    organizationIds: string[],
    now: Date,
    link: string,
  ): Promise<NotificationCandidate[]> {
    if (!organizationIds.length) return [];
    const period = monthStart(now);
    const [organizations, usage] = await Promise.all([
      this.prisma.portalOrganization.findMany({
        where: { id: { in: organizationIds } },
        select: { id: true, name: true, apiMonthlyQuota: true },
      }),
      this.prisma.shieldApiRequest.groupBy({
        by: ['organizationId'],
        where: {
          organizationId: { in: organizationIds },
          createdAt: { gte: period },
        },
        _count: { _all: true },
      }),
    ]);
    const used = new Map(
      usage.map((row) => [row.organizationId, row._count._all]),
    );
    const candidates: NotificationCandidate[] = [];
    for (const organization of organizations) {
      const requests = used.get(organization.id) ?? 0;
      const ratio = requests / organization.apiMonthlyQuota;
      if (ratio < 0.8) continue;
      const reached = ratio >= 1;
      candidates.push({
        category: 'apiUsageAlertsEnabled',
        sourceKey: `api-quota-${reached ? 100 : 80}:${organization.id}:${monthKey(now)}`,
        type: reached ? 'API_QUOTA_REACHED' : 'API_QUOTA_WARNING',
        title: reached ? 'Monthly API quota reached' : 'API usage at 80%',
        body: reached
          ? `${organization.name} has used its monthly quota. Further API calls return 429 until the quota resets on the first day of next month (UTC).`
          : `${organization.name} has used ${Math.floor(ratio * 100)}% of its monthly API quota.`,
        link,
        occurredAt: now,
      });
    }
    return candidates;
  }

  private async servingStatus() {
    if (
      this.healthCache &&
      Date.now() - this.healthCache.at < HEALTH_CACHE_MS
    ) {
      return this.healthCache.status;
    }
    const status = await this.models.getServingStatus();
    this.healthCache = { at: Date.now(), status };
    return status;
  }
}
