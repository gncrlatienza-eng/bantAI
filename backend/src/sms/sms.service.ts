import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';

// Shortened URL services whose domains trigger caution regardless of content.
const SHORTENED_URL_HOSTS = new Set([
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
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private campaignsService: CampaignsService,
  ) {}

  async ingest(userId: string, dto: IngestSmsDto) {
    // Normalize once; all DB lookups keyed on sender use this value so that
    // +639171234567, 09171234567, and 639171234567 resolve to the same record.
    const normalizedSender = this.normalizePhone(dto.sender);

    // Step 1 — check if sender is blocked; suppress before doing any work
    const blocked = await this.prisma.blockedNumber.findUnique({
      where: { userId_sender: { userId, sender: normalizedSender } },
    });
    if (blocked) {
      return { suppressed: true, reason: 'blocked_sender' };
    }

    // Step 2 — store the SMS with the normalized sender so all DB lookups
    // keyed on sender (alerts, verification cache) resolve consistently.
    const message = await this.prisma.smsMessage.create({
      data: {
        userId,
        sender: normalizedSender,
        body: dto.body,
        receivedAt: new Date(dto.receivedAt),
      },
    });

    // Step 3 — call AI service; returns null when model is not ready or service is down
    const aiResult = await this.aiService.classify(dto.body);

    const normalizedBody = dto.body.normalize('NFKC');
    let label: string;
    let score: number;
    let scores: Record<string, number> | undefined;
    let bucket: string | undefined;
    let maskedBody: string;

    if (aiResult) {
      label = aiResult.label;
      score = aiResult.score;
      scores = aiResult.scores;
      bucket = aiResult.bucket;
      maskedBody = aiResult.maskedText;
    } else {
      this.logger.warn(
        `Falling back to local heuristic for message ${message.id}`,
      );
      maskedBody = this.maskLocally(normalizedBody);
      ({ label, score } = this.classifyLocally(maskedBody));
    }

    // Step 4 — route using AI bucket when available, otherwise fall back to score thresholds
    const action = bucket
      ? this.routeFromBucket(bucket as 'safe' | 'unknown' | 'spam' | 'blocked')
      : this.routeFromScore(score);

    // Step 5 — auto-block: if high-confidence smishing, add sender to blocked list.
    // Gated on the routing decision, not the raw score: `score` is the winning
    // class's confidence, so a confidently-Ham message (Ham at 0.94) would
    // otherwise block a legitimate sender.
    if (action === 'blocked') {
      await this.prisma.blockedNumber.upsert({
        where: { userId_sender: { userId, sender: normalizedSender } },
        create: { userId, sender: normalizedSender, source: 'AutoBlock' },
        update: {},
      });
    }

    // Step 6 — determine sender verification status (needed for link suppression trigger)
    const senderContact = await this.prisma.contact.findUnique({
      where: { userId_phone: { userId, phone: normalizedSender } },
    });
    const senderIsUnknown = !senderContact;

    // Step 7 — link suppression:
    //   Triggers when classification is Spam/Scam OR sender is unknown.
    //   Extracts URLs, checks campaign cluster domains + shortened URL services,
    //   and logs suppressed links back to MessageFeatures (per thesis pseudocode).
    const suppressedLinks: string[] = [];
    const shouldSuppress =
      label === 'Spam' || label === 'Scam' || senderIsUnknown;

    if (shouldSuppress) {
      const urls = this.extractUrls(dto.body);
      const clusterDomains = await this.campaignsService.getActiveDomains();

      for (const url of urls) {
        const host = this.extractHost(url);
        const isShortenedUrl = SHORTENED_URL_HOSTS.has(host);
        const isBlocklistedDomain = clusterDomains.has(host);

        if (isShortenedUrl || isBlocklistedDomain) {
          suppressedLinks.push(url);
        }
      }

      // Link campaign cluster if any URL domain matches
      const matchedDomains = urls
        .map((u) => this.extractHost(u))
        .filter((h) => clusterDomains.has(h));
      if (matchedDomains.length > 0) {
        const cluster =
          await this.campaignsService.findByDomains(matchedDomains);
        if (cluster) {
          await this.prisma.$transaction([
            this.prisma.smsMessage.update({
              where: { id: message.id },
              data: { clusterId: cluster.id },
            }),
            this.prisma.campaignCluster.update({
              where: { id: cluster.id },
              data: { messageCount: { increment: 1 } },
            }),
          ]);
          this.logger.log(
            `Message ${message.id} linked to cluster ${cluster.id}`,
          );
        }
      }
    }

    // Step 8 — store preprocessed features (including suppressed links)
    await this.prisma.messageFeature.create({
      data: {
        messageId: message.id,
        normalizedBody,
        maskedBody,
        suppressedLinks,
      },
    });

    // Step 9 — store classification result
    await this.prisma.classification.create({
      data: {
        messageId: message.id,
        label,
        score,
        scores,
        bucket,
      },
    });

    // Step 10 — create an Alert row for flagged messages so the Alerts screen
    //   has something to display. Inbox messages do not generate an alert.
    //   Status mirrors the routing decision: blocked messages are already
    //   suppressed, so they are recorded as Blocked rather than Pending.
    if (action === 'alert' || action === 'blocked') {
      await this.prisma.alert.create({
        data: {
          messageId: message.id,
          status: action === 'blocked' ? 'Blocked' : 'Pending',
        },
      });
    }

    return {
      messageId: message.id,
      classification: { label, score },
      action,
      senderStatus: senderIsUnknown ? 'unknown' : 'verified',
      suppressedLinks,
    };
  }

  async getAlerts(userId: string) {
    return this.prisma.alert.findMany({
      where: { message: { userId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        message: {
          select: {
            id: true,
            sender: true,
            body: true,
            receivedAt: true,
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

  private routeFromScore(score: number): 'blocked' | 'alert' | 'inbox' {
    if (score >= 0.9) return 'blocked';
    if (score >= 0.5) return 'alert';
    return 'inbox';
  }

  private maskLocally(normalizedBody: string): string {
    return normalizedBody
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      .replace(/https?:\/\/\S+/gi, '[URL]')
      .replace(/\b(09\d{9}|\+639\d{9}|\d{7,8})\b/g, '[PHONE]')
      .replace(
        /[₱P][\d,]+(\.\d+)?|\b\d+(\.\d+)?\s*(pesos?|php)\b/gi,
        '[AMOUNT]',
      )
      .replace(/\b\d{4,8}\b/g, '[OTP]');
  }

  private classifyLocally(maskedBody: string): {
    label: string;
    score: number;
  } {
    const keywords = [
      '[url]',
      'verify',
      'locked',
      'click',
      'prize',
      'won',
      'gcash',
      'account',
    ];
    const hits = keywords.filter((kw) =>
      maskedBody.toLowerCase().includes(kw),
    ).length;
    const score = Math.min(hits / keywords.length, 0.99);
    let label: string;
    if (score >= 0.9) label = 'Scam';
    else if (score >= 0.5) label = 'Spam';
    else label = 'Ham';
    return { label, score };
  }

  private extractUrls(body: string): string[] {
    const pattern = /https?:\/\/[^\s]+/gi;
    return Array.from(new Set(body.match(pattern) ?? []));
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return url.toLowerCase();
    }
  }

  private normalizePhone(phone: string): string {
    if (/[a-zA-Z]/.test(phone)) return phone.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12)
      return '0' + digits.slice(2);
    return digits;
  }
}
