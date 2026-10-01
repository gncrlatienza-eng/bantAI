import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AuditEventType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { maskSmsBody } from '../sms/sms-privacy-masker';
import { SubmitReportDto } from './dto/submit-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
        status: true,
        originalLabel: true,
        reportedLabel: true,
        createdAt: true,
      },
    });
  }

  // Admin: list all reports, newest first.
  async findAll(actorUserId: string) {
    const reports = await this.prisma.userReport.findMany({
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
    // An empty result discloses no restricted content, so it is not an
    // access event (manual QA 2026-10-01, F5: audit noise on empty pages).
    if (reports.length) {
      await this.audit.record({
        type: AuditEventType.RESTRICTED_MESSAGE_ACCESSED,
        actorUserId,
        metadata: { source: 'reports', count: reports.length },
      });
    }
    return reports.map(withRemaskedMessage);
  }

  // Admin: list only Pending reports awaiting review.
  async findPending(actorUserId: string) {
    const reports = await this.prisma.userReport.findMany({
      where: { status: 'Pending' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        status: true,
        originalLabel: true,
        reportedLabel: true,
        createdAt: true,
        user: { select: { id: true } },
        message: { select: { id: true, body: true } },
      },
    });
    if (reports.length) {
      await this.audit.record({
        type: AuditEventType.RESTRICTED_MESSAGE_ACCESSED,
        actorUserId,
        metadata: { source: 'pending-reports', count: reports.length },
      });
    }
    return reports.map(withRemaskedMessage);
  }

  // Admin: accept the report — queues it for the next retraining snapshot.
  // This is a retraining decision only. Marking a sender as fraud for every
  // user is a separate, explicit staff action
  // (POST /verification/sender/confirm-fraud), so labelling a message for
  // training never changes a sender's reputation as a side effect.
  async validate(id: string, actorUserId: string, adminNote?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.userReport.update({
          where: { id, status: 'Pending' },
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
        await this.audit.record(
          {
            type: AuditEventType.REPORT_VALIDATED,
            actorUserId,
            metadata: { reportId: id },
          },
          tx,
        );
        return updated;
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        const existing = await this.prisma.userReport.findUnique({
          where: { id },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException('Report has already been reviewed.');
        }
        throw new NotFoundException(`Report ${id} not found`);
      }
      throw err;
    }
  }

  // Admin: discard the report — it will not affect retraining.
  async reject(id: string, actorUserId: string, adminNote?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.userReport.update({
          where: { id, status: 'Pending' },
          data: { status: 'Rejected', adminNote: adminNote ?? null },
          select: { id: true, status: true, adminNote: true, updatedAt: true },
        });
        await this.audit.record(
          {
            type: AuditEventType.REPORT_REJECTED,
            actorUserId,
            metadata: { reportId: id },
          },
          tx,
        );
        return updated;
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        const existing = await this.prisma.userReport.findUnique({
          where: { id },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException('Report has already been reviewed.');
        }
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

// Rows stored before server-side ingest masking may hold a client's unmasked
// body; Admin reads always see the canonical masked form.
function withRemaskedMessage<T extends { message: { body: string } }>(
  report: T,
): T {
  return {
    ...report,
    message: { ...report.message, body: maskSmsBody(report.message.body) },
  };
}
