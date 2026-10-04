import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { maskSmsBody } from '../sms/sms-privacy-masker';
import { fingerprintSender, normalizeSender } from '../auth/phone';
import { CreateTrustedOrganizationDto } from './dto/create-trusted-organization.dto';
import { SenderReputationService } from './sender-reputation.service';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for unknown
const FRAUD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for fraud records
const MINIMUM_CORROBORATING_REPORTS = 2;
// Newest texts from a reported number shown to the reviewing Admin.
const SENDER_DETAIL_MESSAGES = 20;

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private senderReputation: SenderReputationService,
    private audit: AuditService,
  ) {}

  // Familiarity and fraud risk deliberately remain separate. Being in one
  // user's contacts, or being a verified organization, is not evidence that a
  // specific SMS is safe; confirmed fraud always wins the response.
  async verifySender(userId: string, sender: string) {
    const normalized = fingerprintSender(sender);

    const cached = await this.prisma.senderVerificationCache.findUnique({
      where: { sender: normalized },
    });
    const cacheIsCurrent =
      cached && (!cached.expiresAt || cached.expiresAt >= new Date());
    if (cacheIsCurrent && cached.status === 'fraud') {
      return this.assessment(
        sender,
        'fraud',
        'confirmed_fraud',
        'unknown',
        null,
      );
    }

    const organization = await this.findActiveTrustedOrganization(normalized);
    if (organization) {
      return this.assessment(
        sender,
        'verified',
        'verified_organization',
        'verified_organization',
        organization,
      );
    }

    const contact = await this.prisma.contact.findUnique({
      where: { userId_phone: { userId, phone: normalized } },
    });
    if (contact) {
      return this.assessment(
        sender,
        'verified',
        'contact',
        'known_contact',
        null,
      );
    }

    if (cacheIsCurrent) {
      return this.assessment(
        sender,
        cached.status,
        cached.source ?? 'cache',
        'unknown',
        null,
      );
    }

    // A reputation lookup receives only the sender phone number, never SMS
    // text, contacts, or the account identity. It can raise risk but cannot
    // establish familiarity or silently block the sender.
    const external = await this.senderReputation.lookup(sender);
    const status = external?.status ?? 'unknown';
    const source = external?.source ?? 'default';
    const expiresAt =
      external?.expiresAt ?? new Date(Date.now() + CACHE_TTL_MS);

    await this.prisma.senderVerificationCache.upsert({
      where: { sender: normalized },
      create: { sender: normalized, status, source, expiresAt },
      update: { status, source, expiresAt },
    });

    return this.assessment(sender, status, source, 'unknown', null);
  }

  async isConfirmedFraud(sender: string): Promise<boolean> {
    const cached = await this.prisma.senderVerificationCache.findUnique({
      where: { sender: fingerprintSender(sender) },
      select: { status: true, source: true, expiresAt: true },
    });
    return Boolean(
      cached?.status === 'fraud' &&
      cached.source === 'corroborated-admin-review' &&
      (!cached.expiresAt || cached.expiresAt >= new Date()),
    );
  }

  async addTrustedOrganization(
    reviewerId: string,
    dto: CreateTrustedOrganizationDto,
  ) {
    const sender = fingerprintSender(dto.sender);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const organization = await this.prisma.trustedOrganization.upsert({
      where: { sender },
      create: {
        sender,
        name: dto.name.trim(),
        officialDomains: this.normalizeDomains(dto.officialDomains ?? []),
        evidenceUrl: dto.evidenceUrl,
        evidenceType: dto.evidenceType,
        reviewedBy: reviewerId,
        expiresAt,
      },
      update: {
        name: dto.name.trim(),
        officialDomains: this.normalizeDomains(dto.officialDomains ?? []),
        evidenceUrl: dto.evidenceUrl,
        evidenceType: dto.evidenceType,
        reviewedBy: reviewerId,
        expiresAt,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        officialDomains: true,
        evidenceUrl: true,
        evidenceType: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return organization;
  }

  listTrustedOrganizations() {
    return this.prisma.trustedOrganization.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: 200,
      select: {
        id: true,
        name: true,
        officialDomains: true,
        evidenceUrl: true,
        evidenceType: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deactivateTrustedOrganization(id: string, reviewerId: string) {
    try {
      return await this.prisma.trustedOrganization.update({
        where: { id },
        data: { isActive: false, reviewedBy: reviewerId },
        select: { id: true, name: true, isActive: true, updatedAt: true },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new NotFoundException('Trusted organization not found.');
      }
      throw error;
    }
  }

  // Bulk-sync the user's Android contacts. Mobile app calls this on first
  // launch and whenever the contact list changes.
  async syncContacts(
    userId: string,
    contacts: { phone: string; name?: string }[],
  ) {
    const fingerprints = Array.from(
      new Set(
        contacts
          .map((contact) => normalizeSender(contact.phone))
          .filter(Boolean)
          .map((phone) => fingerprintSender(phone)),
      ),
    );

    // Store only a pseudonymous contact fingerprint; names are not needed for
    // the verification decision. The snapshot semantics remove deleted contacts.
    await this.prisma.$transaction(async (tx) => {
      await tx.contact.deleteMany({
        where: {
          userId,
          ...(fingerprints.length ? { phone: { notIn: fingerprints } } : {}),
        },
      });
      if (fingerprints.length) {
        await tx.contact.createMany({
          data: fingerprints.map((phone) => ({ userId, phone, name: null })),
          skipDuplicates: true,
        });
      }
    });
    return { synced: fingerprints.length };
  }

  // A user report is attributable evidence, never a global reputation change.
  async reportFraud(userId: string, sender: string) {
    // Alphanumeric sender IDs ("GCash", "BDO") belong to brands and can be
    // spoofed per message, so a sender-wide fraud flag would hit the real
    // brand too. This is the last point the raw sender exists; everything
    // stored after it is an HMAC fingerprint.
    if (/[a-zA-Z]/.test(sender)) {
      throw new BadRequestException(
        'Only phone-number senders can be reported.',
      );
    }
    const normalized = fingerprintSender(sender);
    // Reports are deduplicated only for the same cache-lifetime window. Once
    // reputation evidence expires, a user may provide fresh corroboration.
    const reportWindow = Math.floor(Date.now() / FRAUD_TTL_MS).toString();
    try {
      await this.prisma.senderReport.create({
        data: { userId, sender: normalized, reportWindow },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('You have already reported this sender.');
      }
      throw error;
    }
    const reportCount = await this.prisma.senderReport.count({
      where: { sender: normalized, status: 'Pending' },
    });
    return {
      sender: this.redactSender(sender),
      status: 'pending_review',
      reportCount,
    };
  }

  async findPendingFraudReports() {
    return this.prisma.senderReport.findMany({
      where: { status: 'Pending' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, sender: true, createdAt: true, reportWindow: true },
    });
  }

  /**
   * What an Admin needs to judge a reported number before confirming it:
   * who reported it (count only), and what that number has actually sent,
   * as the masked texts stored for every user it reached. The sender is
   * still only its HMAC pseudonym; the phone number is never available.
   */
  async findSenderReportDetail(reportId: string, actorUserId: string) {
    const selected = await this.prisma.senderReport.findUnique({
      where: { id: reportId },
      select: { sender: true, reportWindow: true },
    });
    if (!selected) throw new NotFoundException('Sender report not found.');
    const { sender, reportWindow } = selected;

    const [reports, messages, messageTotal, recipients, labels] =
      await Promise.all([
        this.prisma.senderReport.findMany({
          where: { sender, reportWindow },
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true, createdAt: true },
        }),
        this.prisma.smsMessage.findMany({
          where: { sender },
          orderBy: { receivedAt: 'desc' },
          take: SENDER_DETAIL_MESSAGES,
          select: {
            id: true,
            body: true,
            receivedAt: true,
            classification: { select: { label: true, score: true } },
            cluster: { select: { id: true, label: true, category: true } },
          },
        }),
        this.prisma.smsMessage.count({ where: { sender } }),
        this.prisma.smsMessage.groupBy({ by: ['userId'], where: { sender } }),
        this.prisma.classification.groupBy({
          by: ['label'],
          where: { message: { sender } },
          _count: { _all: true },
        }),
      ]);

    if (messages.length) {
      await this.audit.record({
        type: AuditEventType.RESTRICTED_MESSAGE_ACCESSED,
        actorUserId,
        metadata: {
          source: 'admin-sender-report-detail',
          reportId,
          count: messages.length,
        },
      });
    }

    return {
      reportWindow,
      reporterCount: reports.filter((r) => r.status === 'Pending').length,
      requiredReports: MINIMUM_CORROBORATING_REPORTS,
      reports,
      messageTotal,
      recipientCount: recipients.length,
      labelCounts: Object.fromEntries(
        labels.map((l) => [l.label, l._count._all]),
      ) as Record<string, number>,
      messages: messages.map((m) => ({ ...m, body: maskSmsBody(m.body) })),
    };
  }

  async confirmFraud(reportId: string, reviewerId: string, reason: string) {
    const selected = await this.prisma.senderReport.findUnique({
      where: { id: reportId },
    });
    if (!selected || selected.status !== 'Pending') {
      throw new NotFoundException('Pending sender report not found.');
    }
    const reportCount = await this.prisma.senderReport.count({
      where: {
        sender: selected.sender,
        reportWindow: selected.reportWindow,
        status: 'Pending',
      },
    });
    if (reportCount < MINIMUM_CORROBORATING_REPORTS) {
      throw new BadRequestException(
        `At least ${MINIMUM_CORROBORATING_REPORTS} independent pending reports are required.`,
      );
    }
    await this.markSenderFraud(
      selected.sender,
      selected.reportWindow,
      reviewerId,
      reason,
    );
    return { reportId, status: 'fraud', reportCount };
  }

  private async markSenderFraud(
    senderFingerprint: string,
    reportWindow: string,
    reviewerId: string,
    reason: string,
  ) {
    // A verified organization is never flagged sender-wide; spoofed messages
    // from it are handled per message, not by condemning the real sender.
    if (await this.findActiveTrustedOrganization(senderFingerprint)) {
      throw new BadRequestException(
        'Sender is a verified organization and cannot be marked as fraud.',
      );
    }
    const expiresAt = new Date(Date.now() + FRAUD_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.senderReport.updateMany({
        where: { sender: senderFingerprint, reportWindow, status: 'Pending' },
        data: {
          status: 'Validated',
          validatedAt: new Date(),
          reviewedBy: reviewerId,
          reviewReason: reason,
        },
      }),
      this.prisma.senderVerificationCache.upsert({
        where: { sender: senderFingerprint },
        create: {
          sender: senderFingerprint,
          status: 'fraud',
          source: 'corroborated-admin-review',
          expiresAt,
        },
        update: {
          status: 'fraud',
          source: 'corroborated-admin-review',
          expiresAt,
        },
      }),
    ]);
  }

  private findActiveTrustedOrganization(senderFingerprint: string) {
    return this.prisma.trustedOrganization.findFirst({
      where: {
        sender: senderFingerprint,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      select: {
        id: true,
        name: true,
        officialDomains: true,
        evidenceType: true,
      },
    });
  }

  // Normalizes phone numbers for consistent DB lookups.
  // Alphanumeric sender IDs (e.g. "GCash", "PLDT") are returned lowercased as-is
  // so they don't collapse to '' and overwrite each other in the cache.
  private redactSender(sender: string): string {
    const normalized = normalizeSender(sender);
    return normalized.length <= 4
      ? '••••'
      : `${normalized.slice(0, 2)}••••${normalized.slice(-2)}`;
  }

  private assessment(
    sender: string,
    status: string,
    source: string,
    familiarity: 'unknown' | 'known_contact' | 'verified_organization',
    organization: {
      id: string;
      name: string;
      officialDomains: string[];
      evidenceType: string;
    } | null,
  ) {
    return {
      sender: this.redactSender(sender),
      status,
      source,
      familiarity,
      risk:
        status === 'fraud'
          ? source === 'ipqs-phone-reputation'
            ? 'external_high_risk'
            : 'confirmed_fraud'
          : 'unknown',
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            officialDomains: organization.officialDomains,
            evidenceType: organization.evidenceType,
          }
        : null,
    };
  }

  private normalizeDomains(domains: string[]) {
    return Array.from(
      new Set(
        domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean),
      ),
    );
  }
}
