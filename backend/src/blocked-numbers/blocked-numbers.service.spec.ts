import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { BlockedNumbersService } from './blocked-numbers.service';

describe('BlockedNumbersService', () => {
  const prisma: Record<string, unknown> & {
    blockedNumber: Record<string, jest.Mock>;
    alert: Record<string, jest.Mock>;
  } = {
    blockedNumber: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    alert: { updateMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((operation: (tx: unknown) => unknown) =>
    operation(prisma),
  );
  let service: BlockedNumbersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BlockedNumbersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(BlockedNumbersService);
  });

  it('does not return retained sender fingerprints in a block-list response', async () => {
    prisma.blockedNumber.findMany.mockResolvedValue([]);
    await service.list('u1');
    expect(prisma.blockedNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, source: true, createdAt: true },
        take: 100,
      }),
    );
  });

  it('uses a pseudonym rather than a raw number for a block record', async () => {
    await service.block('u1', '+639171234567');
    expect(prisma.blockedNumber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_sender: {
            userId: 'u1',
            sender: expect.not.stringContaining('917'),
          },
        },
      }),
    );
  });

  it('never echoes the sender fingerprint from a block', async () => {
    await service.block('u1', '+639171234567');
    expect(prisma.blockedNumber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, source: true, createdAt: true },
      }),
    );
  });

  it('records the phone-reported block source', async () => {
    await service.block('u1', '+639171234567', 'AutoBlock');
    expect(prisma.blockedNumber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: 'AutoBlock' }),
      }),
    );
  });

  it('moves the sender pending alerts to Blocked, and back on unblock', async () => {
    await service.block('u1', '+639171234567');
    expect(prisma.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'Pending' }),
        data: { status: 'Blocked' },
      }),
    );
    await service.unblock('u1', '+639171234567');
    expect(prisma.alert.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'Blocked' }),
        data: { status: 'Pending' },
      }),
    );
  });
});
