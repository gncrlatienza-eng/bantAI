import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

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

    // Step 2 — preprocess the text (placeholder until Track B delivers the ML service)
    const { normalizedBody, maskedBody } = this.preprocess(dto.body);

    // Step 3 — store the preprocessed features
    await this.prisma.messageFeature.create({
      data: {
        messageId: message.id,
        normalizedBody,
        maskedBody,
      },
    });

    // Step 4 — classify (placeholder until ML service is ready)
    const { label, score } = this.classify(maskedBody);

    // Step 5 — store the classification result
    await this.prisma.classification.create({
      data: {
        messageId: message.id,
        label,
        score,
      },
    });

    // Step 6 — determine routing action based on confidence score
    const action = this.route(score);

    return {
      messageId: message.id,
      classification: { label, score },
      action,
    };
  }

  // Placeholder — will be replaced when Track B delivers the FastAPI ML service
  private preprocess(body: string) {
    const normalizedBody = body.normalize('NFKC');

    const maskedBody = normalizedBody
      .replace(/https?:\/\/\S+/gi, '[URL]')
      .replace(/\b\d{10,13}\b/g, '[PHONE]')
      .replace(/\b\d{4,8}\b/g, '[OTP]')
      .replace(/₱[\d,]+(\.\d+)?/g, '[AMOUNT]');

    return { normalizedBody, maskedBody };
  }

  // Placeholder — will be replaced with HTTP call to FastAPI ML service
  private classify(maskedBody: string): { label: string; score: number } {
    const smishingKeywords = [
      '[url]',
      'verify',
      'locked',
      'click',
      'prize',
      'won',
      'gcash',
      'account',
    ];
    const hits = smishingKeywords.filter((kw) =>
      maskedBody.toLowerCase().includes(kw),
    ).length;
    const score = Math.min(hits / smishingKeywords.length, 0.99);

    let label: string;
    if (score >= 0.9) label = 'Likely Smishing';
    else if (score >= 0.5) label = 'Suspicious';
    else label = 'Unknown';

    return { label, score };
  }

  private route(score: number): 'blocked' | 'alert' | 'inbox' {
    if (score >= 0.9) return 'blocked';
    if (score >= 0.5) return 'alert';
    return 'inbox';
  }
}
