import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BlockedNumbersService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.blockedNumber.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Idempotent — mirrors sms.service.ts's auto-block upsert (update: {} leaves
  // an existing row, e.g. one the backend already auto-blocked, untouched
  // rather than overwriting its source/createdAt on every sync).
  block(userId: string, sender: string) {
    const normalized = this.normalizePhone(sender);
    return this.prisma.blockedNumber.upsert({
      where: { userId_sender: { userId, sender: normalized } },
      create: { userId, sender: normalized, source: 'UserBlock' },
      update: {},
    });
  }

  async unblock(userId: string, sender: string) {
    const normalized = this.normalizePhone(sender);
    try {
      await this.prisma.blockedNumber.delete({
        where: { userId_sender: { userId, sender: normalized } },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException('Blocked number not found.');
      }
      throw err;
    }
  }

  // Duplicated from sms.service.ts / verification.service.ts rather than
  // factored out — matches this codebase's existing convention of a private
  // per-service copy (see those two files) rather than introducing a shared
  // util as an unrelated refactor.
  private normalizePhone(phone: string): string {
    if (/[a-zA-Z]/.test(phone)) return phone.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12)
      return '0' + digits.slice(2);
    return digits;
  }
}
