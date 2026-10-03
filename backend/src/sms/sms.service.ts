import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { EmergingWavesService } from '../campaigns/emerging-waves.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { fingerprintSender } from '../auth/phone';
import { VerificationService } from '../verification/verification.service';
import { AiService } from '../ai/ai.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { maskSmsBody } from './sms-privacy-masker';

// Shortened URL services whose domains trigger caution regardless of content.
const SHORTENED_URL_HOSTS = new Set<string>([
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'buff.ly',
  'short.io',
  'rb.gy',
  'is.gd',
  'v.gd',
  'cutt.ly',
  'bl.ink',
]);

const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const ADMIN_CLASSIFICATION_SELECT = {
  id: true,
  messageId: true,
  label: true,
  score: true,
  bucket: true,
  createdAt: true,
  message: {
    select: {
      receivedAt: true,
      alerts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true },
      },
    },
  },
} as const satisfies Prisma.ClassificationSelect;

type AdminClassificationRecord = Prisma.ClassificationGetPayload<{
  select: typeof ADMIN_CLASSIFICATION_SELECT;
}>;

function toAdminClassification({
  message,
  ...classification
}: AdminClassificationRecord) {
  return {
    ...classification,
    receivedAt: message.receivedAt,
    alertStatus: message.alerts[0]?.status ?? null,
  };
}

function normalizeDomains(domains: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const raw of domains ?? []) {
    const host = raw
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
    if (HOSTNAME.test(host)) out.add(host);
  }
  return [...out];
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private prisma: PrismaService,
    private campaignsService: CampaignsService,
    private verificationService: VerificationService,
    private aiService: AiService,
    private emergingWaves: EmergingWavesService,
  ) {}

  async ingest(userId: string, dto: IngestSmsDto) {
    // Only a server-side HMAC pseudonym is persisted. Raw sender identifiers
    // and raw SMS bodies stay on the device.
    const normalizedSender = fingerprintSender(dto.sender);

    // A blocked sender still needs a durable classification for historical
    // backfill and the admin log. Suppression affects alerts on the phone,
    // not whether the message can be audited.
    const blocked = await this.prisma.blockedNumber.findUnique({
      where: { userId_sender: { userId, sender: normalizedSender } },
    });

    // `maskedBody` is a client claim. Re-mask it before the AI call and before
    // anything is stored, so an older or modified client cannot persist the
    // original SMS. A compliant client's text passes through unchanged.
    const maskedBody = maskSmsBody(dto.maskedBody);
    if (!maskedBody) {
      throw new BadRequestException('maskedBody is empty after masking.');
    }
    if (maskedBody !== dto.maskedBody.normalize('NFKC').trim()) {
      this.logger.warn(
        'SMS ingest payload changed under server masking; stored the re-masked text.',
      );
    }

    // Hostnames the phone extracted before masking. Anything that is not a
    // bare hostname (a full URL with a path, an address) is dropped here so
    // it can reach neither the AI service nor campaign lookups.
    const domains = normalizeDomains(dto.domains);
    const modelResult = await this.aiService.classifyMasked(
      maskedBody,
      domains,
    );
    const classificationSource = modelResult ? 'model' : 'device_fallback';
    const label = modelResult?.label ?? dto.label ?? 'Ham';
    const score = modelResult?.score ?? dto.score ?? 0;
    const bucket = modelResult?.bucket ?? dto.bucket;
    // Only the model's own distribution is stored; device fallbacks have none.
    const scores = modelResult?.scores ?? undefined;
    // A device fallback may preserve its bucket for audit/display purposes,
    // but routing it from that untrusted metadata can hide a Scam/Spam when
    // the device sends `unknown`. Route fallback classifications by label.
    const candidateAction = modelResult
      ? this.routeFromBucket(modelResult.bucket)
      : this.routeFromLabel(label, score);
    // A device can submit arbitrary telemetry. A missing/unavailable model may
    // still create an alert, but never lets client-provided metadata block a
    // number automatically.
    const action =
      !modelResult && candidateAction === 'blocked' ? 'alert' : candidateAction;

    // A global fraud result is established only after independent reports and
    // an administrator's review. It raises the risk level but never performs a
    // block silently: the thesis workflow requires the user to choose Block,
    // Report, or Ignore after a high-confidence warning.
    const confirmedFraud = await this.verificationService.isConfirmedFraud(
      dto.sender,
    );
    const senderVerification = await this.verificationService.verifySender(
      userId,
      dto.sender,
    );
    const effectiveAction =
      confirmedFraud || action === 'blocked' ? 'alert' : action;

    // A high-risk model bucket creates an alert, never an automatic block.
    // Only the user's explicit blocked-number action can block the sender.
    // The AI's own campaign match (embedding / hybrid / domain tiers) comes
    // first; a shared blasted domain is the fallback when the model had no
    // match or was unavailable.
    const modelCampaign =
      modelResult?.campaign?.matched && modelResult.campaign.clusterId
        ? await this.campaignsService.findActiveById(
            modelResult.campaign.clusterId,
          )
        : null;
    const domainCampaign =
      !modelCampaign && domains.length
        ? await this.campaignsService.findByDomains(domains)
        : null;
    const cluster = modelCampaign ?? domainCampaign;
    const campaignMatchSource = modelCampaign
      ? 'model'
      : domainCampaign
        ? 'domain_fallback'
        : null;

    // Link suppression: for flagged messages or unknown senders, mark
    // shortener/known-campaign domains so the mobile UI can strip or warn on
    // them. Only domains are available server-side (mobile masks the raw
    // body), so the payload is domain-shaped rather than full URLs.
    const shouldSuppress =
      label === 'Spam' ||
      label === 'Scam' ||
      senderVerification.familiarity === 'unknown';
    const suppressedLinks: string[] = [];
    if (shouldSuppress && domains.length) {
      const clusterDomains = await this.campaignsService.getActiveDomains();
      for (const domain of domains) {
        if (SHORTENED_URL_HOSTS.has(domain) || clusterDomains.has(domain)) {
          suppressedLinks.push(domain);
        }
      }
    }

    // Create the message, derived metadata, classification, alert, and campaign
    // reference as one transaction. `sourceId` provides idempotency. Blocking
    // happens only through the user's explicit blocked-number action.
    let result: {
      id: string;
      duplicate: boolean;
      campaignId: string | null;
      campaignMatchSource: string | null;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.smsMessage.findUnique({
          where: { userId_sourceId: { userId, sourceId: dto.sourceId } },
          select: {
            id: true,
            trusted: true,
            clusterId: true,
            campaignMatchSource: true,
            classification: { select: { id: true } },
            alerts: { select: { id: true, status: true } },
          },
        });
        if (existing) {
          // Historical backfill can arrive while AI is unavailable. A later
          // retry must replace device telemetry with the server decision;
          // otherwise an old locally missed scam stays Ham forever.
          if (!existing.trusted && modelResult) {
            // Compare-and-set prevents concurrent retries from promoting or
            // creating alerts for the same fallback twice.
            const promoted = await tx.smsMessage.updateMany({
              where: { id: existing.id, trusted: false },
              data: { trusted: true },
            });
            if (promoted.count === 1) {
              // The authoritative classification happened now, so a
              // recovered threat appears at the top of the admin timeline.
              const classification = existing.classification
                ? await tx.classification.update({
                    where: { id: existing.classification.id },
                    data: {
                      label,
                      score,
                      scores,
                      bucket,
                      createdAt: new Date(),
                    },
                  })
                : await tx.classification.create({
                    data: {
                      messageId: existing.id,
                      label,
                      score,
                      scores,
                      bucket,
                    },
                  });
              if (modelResult.indicators?.length) {
                await tx.explainableIndicator.upsert({
                  where: { classificationId: classification.id },
                  create: {
                    classificationId: classification.id,
                    indicators: modelResult.indicators,
                  },
                  update: { indicators: modelResult.indicators },
                });
              }
              if (
                !blocked &&
                effectiveAction === 'alert' &&
                !existing.alerts.length
              ) {
                await tx.alert.create({
                  data: { messageId: existing.id, status: 'Pending' },
                });
              }
              if (
                effectiveAction !== 'alert' &&
                existing.alerts.some((alert) => alert.status === 'Pending')
              ) {
                await tx.alert.deleteMany({
                  where: { messageId: existing.id, status: 'Pending' },
                });
              }
            }
          } else if (!existing.trusted && !existing.classification) {
            // Repair a legacy message row that predates classification
            // persistence, even if this retry still uses device fallback.
            await tx.classification.create({
              data: { messageId: existing.id, label, score, scores, bucket },
            });
            if (
              !blocked &&
              effectiveAction === 'alert' &&
              !existing.alerts.length
            ) {
              await tx.alert.create({
                data: { messageId: existing.id, status: 'Pending' },
              });
            }
          }
          // A re-send links a message stored before its campaign existed
          // (e.g. ingested before a campaign sync). Only this user's own row
          // changes; global campaign counts are not touched.
          if (!existing.clusterId && cluster) {
            const linkedId = await this.lockActiveCampaign(tx, cluster.id);
            if (linkedId) {
              await tx.smsMessage.update({
                where: { id: existing.id },
                data: { clusterId: linkedId, campaignMatchSource },
              });
              return {
                id: existing.id,
                duplicate: true,
                campaignId: linkedId,
                campaignMatchSource,
              };
            }
          }
          return {
            id: existing.id,
            duplicate: true,
            campaignId: existing.clusterId,
            campaignMatchSource: existing.campaignMatchSource,
          };
        }

        const campaignId = cluster
          ? await this.lockActiveCampaign(tx, cluster.id)
          : null;
        const persistedMatchSource = campaignId ? campaignMatchSource : null;

        const message = await tx.smsMessage.create({
          data: {
            userId,
            sender: normalizedSender,
            body: maskedBody,
            sourceId: dto.sourceId,
            // Trusted-sample rule (audit 2026-09-30, finding 4): a message
            // is trusted when its stored classification was computed by the
            // backend's AI service. Device-fallback labels and scores are
            // client telemetry and never feed drift detection or metrics.
            trusted: modelResult !== null,
            receivedAt: new Date(dto.receivedAt),
            clusterId: campaignId,
            campaignMatchSource: persistedMatchSource,
          },
        });
        // Only a server-model match may advance global campaign counts.
        // Domain telemetry submitted by a device can help link its own record,
        // but remains non-authoritative for global intelligence.
        if (modelCampaign && campaignId === modelCampaign.id) {
          await tx.campaignCluster.update({
            where: { id: modelCampaign.id },
            data: { messageCount: { increment: 1 } },
          });
        }
        await tx.messageFeature.create({
          data: {
            messageId: message.id,
            normalizedBody: maskedBody,
            maskedBody,
            suppressedLinks,
          },
        });
        const classification = await tx.classification.create({
          data: { messageId: message.id, label, score, scores, bucket },
        });
        if (modelResult?.indicators?.length) {
          await tx.explainableIndicator.create({
            data: {
              classificationId: classification.id,
              indicators: modelResult.indicators,
            },
          });
        }
        // Client telemetry may link to an existing campaign for the owner's
        // local metadata view, but it cannot change global campaign counts.
        if (!blocked && effectiveAction === 'alert') {
          await tx.alert.create({
            data: {
              messageId: message.id,
              status: 'Pending',
            },
          });
        }
        return {
          id: message.id,
          duplicate: false,
          campaignId,
          campaignMatchSource: persistedMatchSource,
        };
      });
    } catch (error) {
      // A concurrent retry can win between the lookup and insert. The unique
      // key is the authority; resolve that race as a successful idempotent read.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.prisma.smsMessage.findUnique({
        where: { userId_sourceId: { userId, sourceId: dto.sourceId } },
        select: { id: true, clusterId: true, campaignMatchSource: true },
      });
      if (!existing) throw error;
      result = {
        id: existing.id,
        duplicate: true,
        campaignId: existing.clusterId,
        campaignMatchSource: existing.campaignMatchSource,
      };
    }

    // A scam no known campaign matched may be part of a new blast; group it
    // with similar unmatched texts shortly, off the request path.
    if (label === 'Scam' && !result.campaignId) this.emergingWaves.schedule();

    return {
      suppressed: Boolean(blocked),
      ...(blocked ? { reason: 'blocked_sender' } : {}),
      messageId: result.id,
      classification: { label, score, bucket },
      classificationSource,
      action: effectiveAction,
      senderStatus: senderVerification.familiarity,
      senderVerification,
      suppressedLinks,
      // Lets the phone group its own messages by campaign and category
      // without a second request per message. Describes the campaign that was
      // actually stored (result.campaignId), which for a duplicate can be an
      // earlier link rather than this request's match.
      campaign: await this.storedCampaign(result.campaignId, cluster),
      campaignId: result.campaignId,
      campaignMatchSource: result.campaignMatchSource,
      duplicate: result.duplicate,
    };
  }

  // The outside lookup is only a candidate. A row lock makes archival and
  // merge wait until this write finishes, or makes the write see the inactive
  // campaign and leave the message unassigned.
  private async lockActiveCampaign(
    tx: Prisma.TransactionClient,
    clusterId: string,
  ): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CampaignCluster"
      WHERE id = ${clusterId} AND "isActive" = true AND "archivedAt" IS NULL
      FOR SHARE
    `;
    return rows[0]?.id ?? null;
  }

  private async storedCampaign(
    campaignId: string | null,
    candidate: {
      id: string;
      label: string | null;
      category: string | null;
    } | null,
  ) {
    if (!campaignId) return null;
    const campaign =
      candidate?.id === campaignId
        ? candidate
        : await this.campaignsService.findActiveById(campaignId);
    return campaign
      ? { id: campaign.id, label: campaign.label, category: campaign.category }
      : null;
  }

  async getAlerts(
    userId: string,
    page: { before?: string; beforeId?: string; limit?: number } = {},
  ) {
    return this.prisma.alert.findMany({
      // Alerts are smishing only. Earlier builds created an Alert for every
      // model Spam (promos); those rows are excluded here rather than deleted,
      // so every existing environment is corrected without a data migration.
      where: {
        message: {
          userId,
          NOT: { classification: { is: { bucket: 'spam' } } },
        },
        ...(page.before ? { OR: alertCursor(page.before, page.beforeId) } : {}),
      },
      // id breaks createdAt ties so keyset paging never skips an alert.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit ?? 100,
      select: alertSelect(userId),
    });
  }

  async getAlertForMessage(userId: string, messageId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        messageId,
        message: {
          userId,
          NOT: { classification: { is: { bucket: 'spam' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: alertSelect(userId),
    });
    if (!alert) {
      throw new NotFoundException(`No alert for message ${messageId}`);
    }
    return alert;
  }

  // Admin model-log view. Deliberately omit message body, sender, user, and
  // report data: the registry only needs aggregate-safe classification facts.
  async getAdminClassifications() {
    const classifications = await this.prisma.classification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: ADMIN_CLASSIFICATION_SELECT,
    });

    return classifications.map(toAdminClassification);
  }

  // Cursor pagination keeps historical detections reachable after a phone
  // backfills its inbox. The old log endpoint remains for existing clients.
  async getAdminClassificationHistory(options: {
    label?: string;
    cursor?: string;
    limit?: number;
  }) {
    const label = options.label ?? 'threats';
    if (!['all', 'threats', 'Ham', 'Spam', 'Scam'].includes(label)) {
      throw new BadRequestException('Invalid classification filter.');
    }
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100.');
    }
    if (options.cursor && !/^[0-9a-f-]{36}$/i.test(options.cursor)) {
      throw new BadRequestException('Invalid classification cursor.');
    }
    const where: Prisma.ClassificationWhereInput =
      label === 'all'
        ? {}
        : label === 'threats'
          ? { label: { in: ['Scam', 'Spam'] } }
          : { label };
    const classifications = await this.prisma.classification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: ADMIN_CLASSIFICATION_SELECT,
    });
    const page = classifications.slice(0, limit);
    return {
      items: page.map(toAdminClassification),
      nextCursor:
        classifications.length > limit ? page[page.length - 1].id : null,
    };
  }

  // Admin mobile-sync overview. Counts are intentionally aggregate-only and
  // the recent rows reuse the privacy-minimized classification contract above.
  // A "synced account" is a user with at least one stored SmsMessage; the
  // schema does not persist a stable device identifier, so this must not be
  // presented as a physical-device count.
  async getAdminMobileSync() {
    const [
      totalMessages,
      syncedUsers,
      labelCounts,
      latestClassification,
      recent,
    ] = await Promise.all([
      this.prisma.smsMessage.count(),
      this.prisma.smsMessage.findMany({
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.classification.groupBy({
        by: ['label'],
        _count: { _all: true },
      }),
      this.prisma.classification.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.getAdminClassifications(),
    ]);

    const counts = Object.fromEntries(
      labelCounts.map((item) => [item.label, item._count._all]),
    );

    return {
      totalMessages,
      syncedAccounts: syncedUsers.length,
      classifiedMessages: labelCounts.reduce(
        (total, item) => total + item._count._all,
        0,
      ),
      scamCount: counts.Scam ?? 0,
      spamCount: counts.Spam ?? 0,
      hamCount: counts.Ham ?? 0,
      latestSyncAt: latestClassification?.createdAt ?? null,
      recent,
    };
  }

  async getIndicators(userId: string, messageId: string) {
    const message = await this.prisma.smsMessage.findUnique({
      where: { id: messageId },
      select: {
        userId: true,
        classification: {
          select: {
            indicator: { select: { indicators: true } },
          },
        },
      },
    });

    if (!message || message.userId !== userId) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const indicators =
      (message.classification?.indicator?.indicators as {
        tag: string;
        weight: number;
      }[]) ?? [];
    return { indicators };
  }

  // Called by the AI/ML service after SHAP analysis to store explainability data.
  async storeIndicators(
    messageId: string,
    indicators: { tag: string; weight: number }[],
  ) {
    const classification = await this.prisma.classification.findUnique({
      where: { messageId },
    });
    if (!classification) {
      throw new NotFoundException(
        `No classification found for message ${messageId}`,
      );
    }

    return this.prisma.explainableIndicator.upsert({
      where: { classificationId: classification.id },
      create: { classificationId: classification.id, indicators },
      update: { indicators },
    });
  }

  // Alerts are for smishing only. Spam is promotional/ad content (telco and
  // retail promos) that the client files in its Spam folder, and an
  // uncertain result goes to the client's review bucket -- neither creates an
  // Alert row. The label and bucket in the response tell the client which.
  private routeFromBucket(
    bucket: 'safe' | 'unknown' | 'spam' | 'blocked',
  ): 'blocked' | 'inbox' {
    return bucket === 'blocked' ? 'blocked' : 'inbox';
  }

  private routeFromLabel(
    label: 'Ham' | 'Spam' | 'Scam',
    score: number,
  ): 'blocked' | 'inbox' {
    return label === 'Scam' && score >= 0.9 ? 'blocked' : 'inbox';
  }
}

function alertSelect(userId: string) {
  return {
    id: true,
    status: true,
    createdAt: true,
    message: {
      select: {
        id: true,
        sourceId: true,
        receivedAt: true,
        clusterId: true,
        classification: {
          select: { label: true, score: true, bucket: true },
        },
        // This user's own report on the message, if any (one per user per
        // message), so the phone can file it under Reported and show its
        // review status instead of offering Report again.
        reports: {
          where: { userId },
          select: {
            reportedLabel: true,
            status: true,
            createdAt: true,
            note: true,
            adminNote: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
    },
  } as const;
}

function alertCursor(before: string, beforeId?: string) {
  const at = new Date(before);
  return beforeId
    ? [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: beforeId } }]
    : [{ createdAt: { lt: at } }];
}
