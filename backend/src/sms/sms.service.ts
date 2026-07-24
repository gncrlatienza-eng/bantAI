import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async ingest(userId: string, dto: IngestSmsDto) {
    // Step 1 — store the raw SMS
    const message = await this.prisma.smsMessage.create({
      data: {
        userId,
        sender: dto.sender,
        body: dto.body,
        receivedAt: new Date(dto.receivedAt),
      },
    });

    // Step 2 — call AI service; returns null when model is not ready or service is down
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

    // Step 3 — store preprocessed features (AI masked text when available)
    await this.prisma.messageFeature.create({
      data: {
        messageId: message.id,
        normalizedBody,
        maskedBody,
      },
    });

    // Step 4 — store classification result
    await this.prisma.classification.create({
      data: {
        messageId: message.id,
        label,
        score,
        scores,
        bucket,
      },
    });

    // Step 5 — route using AI bucket when available, otherwise fall back to score thresholds
    const action = bucket
      ? this.routeFromBucket(bucket as 'safe' | 'unknown' | 'spam' | 'blocked')
      : this.routeFromScore(score);

    return {
      messageId: message.id,
      classification: { label, score },
      action,
    };
  }

  private routeFromBucket(
    bucket: 'safe' | 'unknown' | 'spam' | 'blocked',
  ): 'blocked' | 'alert' | 'inbox' {
    if (bucket === 'blocked') return 'blocked';
    if (bucket === 'spam') return 'alert';
    return 'inbox'; // safe | unknown
  }

  private routeFromScore(score: number): 'blocked' | 'alert' | 'inbox' {
    if (score >= 0.9) return 'blocked';
    if (score >= 0.5) return 'alert';
    return 'inbox';
  }

  // Local fallback — mirrors AI service masking order to stay as consistent as possible
  private maskLocally(normalizedBody: string): string {
    return normalizedBody
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
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
    if (score >= 0.9) label = 'Likely Smishing';
    else if (score >= 0.5) label = 'Suspicious';
    else label = 'Unknown';
    return { label, score };
  }
}
