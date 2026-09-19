import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { BlockedNumbersService } from './blocked-numbers.service';

describe('BlockedNumbersService', () => {
  const prisma = {
    blockedNumber: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };
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
});
