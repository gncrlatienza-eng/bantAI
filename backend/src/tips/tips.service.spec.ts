import { PrismaService } from '../../database/prisma.service';
import { TipsService } from './tips.service';

describe('TipsService', () => {
  const prisma = {
    safetyTip: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new TipsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('public listing returns published tips only with a bounded safe select', async () => {
    prisma.safetyTip.findMany.mockResolvedValue([]);
    await expect(service.listPublished()).resolves.toEqual([]);
    expect(prisma.safetyTip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, take: 100 }),
    );
    const select = prisma.safetyTip.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('isPublished');
    expect(select).not.toHaveProperty('createdAt');
  });

  it('normalizes authored content before persistence', async () => {
    prisma.safetyTip.create.mockResolvedValue({ id: 'tip-1' });
    await service.create({
      title: '  Verify links  ',
      body: '  Check the sender before opening any link.  ',
      region: '  PH  ',
    });
    expect(prisma.safetyTip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Verify links',
          body: 'Check the sender before opening any link.',
          region: 'PH',
        }),
      }),
    );
  });
});
