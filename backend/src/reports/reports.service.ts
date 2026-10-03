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

// What the Admin Reports page needs to judge a report: the masked body, what
// the model said, and when it arrived. Sender stays an HMAC and is not sent.
const REPORT_MESSAGE_SELECT = {
  id: true,
  body: true,
  receivedAt: true,
  clusterId: true,
  classification: { select: { label: true, score: true, bucket: true } },
} as const;

// The phone keeps the full list; older reports past this stay on the backend.
const MY_REPORTS_LIMIT = 500;

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

    const note = dto.note ? maskSmsBody(dto.note) || null : null;

    // The report and the alert's server-side status move together, so the
    // Admin overview's alertsByStatus reflects what users actually did.
    return this.prisma
      .$transaction(async (tx) => {
        const report = await tx.userReport.create({
          data: {
            userId,
            messageId: dto.messageId,
            originalLabel,
            reportedLabel: dto.reportedLabel,
            note,
            groupId: dto.groupId ?? null,
            status: 'Pending',
          },
          select: {
            id: true,
            groupId: true,
            status: true,
            originalLabel: true,
            reportedLabel: true,
            note: true,
            createdAt: true,
          },
        });
        await tx.alert.updateMany({
          where: { messageId: dto.messageId, status: { not: 'Reported' } },
          data: { status: 'Reported' },
        });
        return report;
      })
      .catch((err: unknown) => {
        // Two submissions racing past the findUnique check above.
        if ((err as { code?: string }).code === 'P2002') {
          throw new ConflictException(
            'You have already reported this message.',
          );
        }
        throw err;
      });
  }

  // Mobile: the signed-in user's own reports, newest first, shaped like an
  // alert (GET /sms/alerts) so the phone files them on its Reported page with
  // the same parsing. A report on a message the model called safe never had
  // an alert, so without this it was saved but shown nowhere on the phone.
  // No body or sender: the phone shows its own copy of the SMS (sourceId).
  async findMine(userId: string) {
    const reports = await this.prisma.userReport.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MY_REPORTS_LIMIT,
      select: {
        id: true,
        groupId: true,
        reportedLabel: true,
        status: true,
        note: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
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
    return reports.map((report) => ({
      id: report.id,
      groupId: report.groupId,
      status: 'Reported',
      createdAt: report.createdAt,
      message: {
        ...report.message,
        reports: [
          {
            reportedLabel: report.reportedLabel,
            status: report.status,
            createdAt: report.createdAt,
            // The phone's report page: what the user wrote, and the reviewer's
            // reason once it's been accepted or rejected (updatedAt is when).
            note: report.note,
            adminNote: report.adminNote,
            reviewedAt: report.status === 'Pending' ? null : report.updatedAt,
          },
        ],
      },
    }));
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
        note: true,
        groupId: true,
        user: { select: { id: true } },
        message: { select: REPORT_MESSAGE_SELECT },
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
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        note: true,
        groupId: true,
        user: { select: { id: true } },
        message: { select: REPORT_MESSAGE_SELECT },
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
