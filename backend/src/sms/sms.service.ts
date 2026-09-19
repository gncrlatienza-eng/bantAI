import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { fingerprintSender } from '../auth/phone';
import { VerificationService } from '../verification/verification.service';
import { AiService } from '../ai/ai.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';

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

@Injectable()
export class SmsService {
  constructor(
    private prisma: PrismaService,
    private campaignsService: CampaignsService,
    private verificationService: VerificationService,
    private aiService: AiService,
  ) {}

  async ingest(userId: string, dto: IngestSmsDto) {
    // Only a server-side HMAC pseudonym is persisted. Raw sender identifiers
    // and raw SMS bodies stay on the device.
    const normalizedSender = fingerprintSender(dto.sender);

    // Step 1 — check if sender is blocked; suppress before doing any work
    const blocked = await this.prisma.blockedNumber.findUnique({
      where: { userId_sender: { userId, sender: normalizedSender } },
    });
    if (blocked) {
      return { suppressed: true, reason: 'blocked_sender' };
    }

    const modelResult = await this.aiService.classifyMasked(dto.maskedBody);
    const classificationSource = modelResult ? 'model' : 'device_fallback';
    const label = modelResult?.label ?? dto.label ?? 'Ham';
    const score = modelResult?.score ?? dto.score ?? 0;
    const bucket = modelResult?.bucket ?? dto.bucket;
    const candidateAction = bucket
      ? this.routeFromBucket(bucket)
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

    // Step 5 — auto-block: if high-confidence smishing, add sender to blocked list.
    // Gated on the routing decision, not the raw score: `score` is the winning
    // class's confidence, so a confidently-Ham message (Ham at 0.94) would
    // otherwise block a legitimate sender.
    const domains = (dto.domains ?? []).map((domain) => domain.toLowerCase());
    const cluster = domains.length
      ? await this.campaignsService.findByDomains(domains)
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
    let result: { id: string; duplicate: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.smsMessage.findUnique({
          where: { userId_sourceId: { userId, sourceId: dto.sourceId } },
          select: { id: true },
        });
        if (existing) return { id: existing.id, duplicate: true };

        const message = await tx.smsMessage.create({
          data: {
            userId,
            sender: normalizedSender,
            body: dto.maskedBody.normalize('NFKC'),
            sourceId: dto.sourceId,
            trusted: false,
            receivedAt: new Date(dto.receivedAt),
            clusterId: cluster?.id,
          },
        });
        await tx.messageFeature.create({
          data: {
            messageId: message.id,
            normalizedBody: dto.maskedBody.normalize('NFKC'),
            maskedBody: dto.maskedBody,
            suppressedLinks,
          },
        });
        const classification = await tx.classification.create({
          data: { messageId: message.id, label, score, bucket },
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
        if (effectiveAction === 'alert') {
          await tx.alert.create({
            data: {
              messageId: message.id,
              status: 'Pending',
            },
          });
        }
        return { id: message.id, duplicate: false };
      });
    } catch (error) {
      // A concurrent retry can win between the lookup and insert. The unique
      // key is the authority; resolve that race as a successful idempotent read.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.prisma.smsMessage.findUnique({
        where: { userId_sourceId: { userId, sourceId: dto.sourceId } },
        select: { id: true },
      });
      if (!existing) throw error;
      result = { id: existing.id, duplicate: true };
    }

    return {
      messageId: result.id,
      classification: { label, score },
      classificationSource,
      action: effectiveAction,
      senderStatus: senderVerification.familiarity,
      senderVerification,
      suppressedLinks,
      duplicate: result.duplicate,
    };
  }

  async getAlerts(userId: string) {
    return this.prisma.alert.findMany({
      where: { message: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
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
          },
        },
      },
    });
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

  private routeFromBucket(
    bucket: 'safe' | 'unknown' | 'spam' | 'blocked',
  ): 'blocked' | 'alert' | 'inbox' {
    if (bucket === 'blocked') return 'blocked';
    if (bucket === 'spam') return 'alert';
    return 'inbox';
  }

  private routeFromLabel(
    label: 'Ham' | 'Spam' | 'Scam',
    score: number,
  ): 'blocked' | 'alert' | 'inbox' {
    if (label === 'Scam' && score >= 0.9) return 'blocked';
    if (label === 'Spam' || label === 'Scam') return 'alert';
    return 'inbox';
  }
}
