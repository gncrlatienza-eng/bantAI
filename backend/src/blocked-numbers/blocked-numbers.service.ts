import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintSender } from '../auth/phone';
import { BlockSource } from './dto/block-number.dto';

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
  async block(
    userId: string,
    sender: string,
    source: BlockSource = 'UserBlock',
  ) {
    const normalized = fingerprintSender(sender);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.blockedNumber.upsert({
        where: { userId_sender: { userId, sender: normalized } },
        create: { userId, sender: normalized, source },
        update: {},
        // Same rule as list(): the HMAC never goes back to a client.
        select: { id: true, source: true, createdAt: true },
      });
      // Server-side alert state follows the phone's block, so the Admin
      // overview's alertsByStatus is not stuck on Pending.
      await tx.alert.updateMany({
        where: {
          status: 'Pending',
          message: { userId, sender: normalized },
        },
        data: { status: 'Blocked' },
      });
      return row;
    });
  }

  async unblock(userId: string, sender: string) {
    const normalized = fingerprintSender(sender);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.blockedNumber.delete({
          where: { userId_sender: { userId, sender: normalized } },
        });
        await tx.alert.updateMany({
          where: {
            status: 'Blocked',
            message: { userId, sender: normalized },
          },
          data: { status: 'Pending' },
        });
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException('Blocked number not found.');
      }
      throw err;
    }
  }
}
