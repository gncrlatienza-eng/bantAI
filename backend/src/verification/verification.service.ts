import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for unknown
const FRAUD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for fraud records

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  // Two-stage sender verification (per thesis operational framework):
  //   Stage 1 — check user's synced contact list
  //   Stage 2 — check external API cache (API TBD; returns unknown until integrated)
  async verifySender(userId: string, sender: string) {
    const normalized = this.normalizePhone(sender);

    // Stage 1: known contact?
    const contact = await this.prisma.contact.findUnique({
      where: { userId_phone: { userId, phone: normalized } },
    });

    if (contact) {
      return {
        sender,
        status: 'verified',
        source: 'contact',
        name: contact.name ?? null,
      };
    }

    // Stage 2: cached external API result (fraud reports or previous lookups)
    const cached = await this.prisma.senderVerificationCache.findUnique({
      where: { sender: normalized },
    });

    if (cached) {
      const expired = cached.expiresAt && cached.expiresAt < new Date();
      if (!expired) {
        return {
          sender,
          status: cached.status,
          source: cached.source,
          name: null,
        };
      }
    }

    // External API stub — no trusted API integrated yet.
    // Falls through to unknown until the team selects a provider.
    const status = 'unknown';
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    await this.prisma.senderVerificationCache.upsert({
      where: { sender: normalized },
      create: { sender: normalized, status, source: 'default', expiresAt },
      update: { status, source: 'default', expiresAt },
    });

    return { sender, status, source: 'default', name: null };
  }

  // Bulk-sync the user's Android contacts. Mobile app calls this on first
  // launch and whenever the contact list changes.
  async syncContacts(
    userId: string,
    contacts: { phone: string; name?: string }[],
  ) {
    const normalized = contacts.map((c) => ({
      userId,
      phone: this.normalizePhone(c.phone),
      name: c.name ?? null,
    }));

    // Batch all upserts into a single transaction — avoids N sequential round
    // trips for large contact lists (up to 5000 items per request).
    const upserts = normalized
      .filter((c) => c.phone)
      .map((contact) =>
        this.prisma.contact.upsert({
          where: { userId_phone: { userId, phone: contact.phone } },
          create: contact,
          update: { name: contact.name },
        }),
      );

    await this.prisma.$transaction(upserts);
    return { synced: upserts.length };
  }

  // User-submitted fraud report — overrides any cached status immediately.
  async reportFraud(sender: string) {
    const normalized = this.normalizePhone(sender);
    const expiresAt = new Date(Date.now() + FRAUD_TTL_MS);

    await this.prisma.senderVerificationCache.upsert({
      where: { sender: normalized },
      create: {
        sender: normalized,
        status: 'fraud',
        source: 'user-report',
        expiresAt,
      },
      update: { status: 'fraud', source: 'user-report', expiresAt },
    });

    return { sender, status: 'fraud' };
  }

  // Normalizes phone numbers for consistent DB lookups.
  // Alphanumeric sender IDs (e.g. "GCash", "PLDT") are returned lowercased as-is
  // so they don't collapse to '' and overwrite each other in the cache.
  private normalizePhone(phone: string): string {
    if (/[a-zA-Z]/.test(phone)) return phone.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12)
      return '0' + digits.slice(2);
    return digits;
  }
}
