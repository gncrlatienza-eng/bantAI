import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintSender } from '../auth/phone';

@Injectable()
export class BlockedNumbersService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.blockedNumber.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      // Sender pseudonyms are server-only enforcement keys, never phone values
      // a client may display or write into Android's block list.
      select: { id: true, source: true, createdAt: true },
    });
  }

  // Idempotent — mirrors sms.service.ts's auto-block upsert (update: {} leaves
  // an existing row, e.g. one the backend already auto-blocked, untouched
  // rather than overwriting its source/createdAt on every sync).
  block(userId: string, sender: string) {
    const normalized = fingerprintSender(sender);
    return this.prisma.blockedNumber.upsert({
      where: { userId_sender: { userId, sender: normalized } },
      create: { userId, sender: normalized, source: 'UserBlock' },
      update: {},
    });
  }

  async unblock(userId: string, sender: string) {
    const normalized = fingerprintSender(sender);
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
}
