import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { SubmitReportDto } from './dto/submit-report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Mobile: user submits a correction (FP or FN) on a classified message.
  async submit(userId: string, dto: SubmitReportDto) {
    // Verify message belongs to this user
    const message = await this.prisma.smsMessage.findUnique({
      where: { id: dto.messageId },
      select: { userId: true, classification: { select: { label: true } } },
    });

    if (!message || message.userId !== userId) {
      throw new NotFoundException(`Message ${dto.messageId} not found`);
    }

    // A report matching the current label is a confirmation ("yes, this
    // is a scam") -- the mobile Alerts tab files every reviewed alert this
    // way. Stored like a correction; the admin dashboard already separates
    // the two (originalLabel !== reportedLabel = mismatch).
    const originalLabel = message.classification?.label ?? 'Ham';

    // One report per user per message (enforced by DB unique constraint too)
    const existing = await this.prisma.userReport.findUnique({
      where: { userId_messageId: { userId, messageId: dto.messageId } },
    });
    if (existing) {
      throw new ConflictException('You have already reported this message.');
    }

    return this.prisma.userReport.create({
      data: {
        userId,
        messageId: dto.messageId,
        originalLabel,
        reportedLabel: dto.reportedLabel,
        status: 'Pending',
      },
      select: {
        id: true,
        originalLabel: true,
        reportedLabel: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // Admin: list all reports, newest first.
  findAll() {
    return this.prisma.userReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        originalLabel: true,
        reportedLabel: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true } },
        message: { select: { id: true, body: true } },
      },
    });
  }

  // Admin: list only Pending reports awaiting review.
  findPending() {
    return this.prisma.userReport.findMany({
      where: { status: 'Pending' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        originalLabel: true,
        reportedLabel: true,
        createdAt: true,
        user: { select: { id: true } },
        message: { select: { id: true, body: true } },
      },
    });
  }

  // Admin: accept the report — queues it for the next retraining snapshot.
  // This is a retraining decision only. Marking a sender as fraud for every
  // user is a separate, explicit staff action
  // (POST /verification/sender/confirm-fraud), so labelling a message for
  // training never changes a sender's reputation as a side effect.
  async validate(id: string, adminNote?: string) {
    try {
      return await this.prisma.userReport.update({
        where: { id },
        data: {
          status: 'Validated',
          adminNote: adminNote ?? null,
          validatedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          adminNote: true,
          validatedAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException(`Report ${id} not found`);
      }
      throw err;
    }
  }

  // Admin: discard the report — it will not affect retraining.
  async reject(id: string, adminNote?: string) {
    try {
      return await this.prisma.userReport.update({
        where: { id },
        data: { status: 'Rejected', adminNote: adminNote ?? null },
        select: { id: true, status: true, adminNote: true, updatedAt: true },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException(`Report ${id} not found`);
      }
      throw err;
    }
  }

  // Used by the retraining cron to count validated reports since a given date.
  countValidatedSince(since: Date): Promise<number> {
    return this.prisma.userReport.count({
      where: { status: 'Validated', validatedAt: { gte: since } },
    });
  }
}
