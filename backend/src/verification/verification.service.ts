import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { fingerprintSender, normalizeSender } from '../auth/phone';
import { CreateTrustedOrganizationDto } from './dto/create-trusted-organization.dto';
import { SenderReputationService } from './sender-reputation.service';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for unknown
const FRAUD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for fraud records
const MINIMUM_CORROBORATING_REPORTS = 2;

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private senderReputation: SenderReputationService,
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

    const organization = await this.prisma.trustedOrganization.findFirst({
      where: {
        sender: normalized,
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
    const expiresAt = new Date(Date.now() + FRAUD_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.senderReport.updateMany({
        where: {
          sender: selected.sender,
          reportWindow: selected.reportWindow,
          status: 'Pending',
        },
        data: {
          status: 'Validated',
          validatedAt: new Date(),
          reviewedBy: reviewerId,
          reviewReason: reason,
        },
      }),
      this.prisma.senderVerificationCache.upsert({
        where: { sender: selected.sender },
        create: {
          sender: selected.sender,
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
    return { reportId, status: 'fraud', reportCount };
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
