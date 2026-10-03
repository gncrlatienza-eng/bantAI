import {
  EMERGING_MATCH_SOURCE,
  EMERGING_ORIGIN,
  EmergingWavesService,
} from './emerging-waves.service';

const body =
  'Congratulations! You won a P50,000 GCash prize. Claim now at gcash-claim.example';

describe('EmergingWavesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    smsMessage: { findMany: jest.fn(), updateMany: jest.fn() },
    campaignCluster: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  let service: EmergingWavesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    prisma.campaignCluster.findMany.mockResolvedValue([]);
    prisma.campaignCluster.create.mockResolvedValue({ id: 'w-new' });
    prisma.smsMessage.updateMany.mockResolvedValue({ count: 2 });
    service = new EmergingWavesService(prisma as never, audit as never);
  });

  it('only considers recent, unlinked Scam texts', async () => {
    prisma.smsMessage.findMany.mockResolvedValue([]);
    await expect(service.run()).resolves.toEqual({
      candidates: 0,
      attached: 0,
      newWaves: 0,
    });
    expect(prisma.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clusterId: null,
          receivedAt: { gte: expect.any(Date) },
          classification: { is: { label: 'Scam' } },
        },
      }),
    );
    expect(prisma.campaignCluster.create).not.toHaveBeenCalled();
  });

  it('creates an unpublished, unrated campaign and links only still-unlinked texts', async () => {
    prisma.smsMessage.findMany.mockResolvedValue([
      { id: 'm1', body },
      { id: 'm2', body },
    ]);

    await expect(service.run('admin-1')).resolves.toEqual({
      candidates: 2,
      attached: 0,
      newWaves: 1,
    });
    expect(prisma.campaignCluster.create).toHaveBeenCalledWith({
      data: {
        label: 'Rewards / prize claim (GCash)',
        category: 'Rewards / prize claim',
        origin: EMERGING_ORIGIN,
        urlDomains: [],
        isActive: true,
      },
      select: { id: true },
    });
    expect(prisma.smsMessage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m1', 'm2'] }, clusterId: null },
      data: { clusterId: 'w-new', campaignMatchSource: EMERGING_MATCH_SOURCE },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        metadata: expect.objectContaining({
          action: 'EMERGING_WAVE_CREATED',
        }),
      }),
      prisma,
    );
  });

  it('drops the new campaign when another writer linked every text first', async () => {
    prisma.smsMessage.findMany.mockResolvedValue([
      { id: 'm1', body },
      { id: 'm2', body },
    ]);
    prisma.smsMessage.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.run()).resolves.toMatchObject({ newWaves: 0 });
    expect(prisma.campaignCluster.delete).toHaveBeenCalledWith({
      where: { id: 'w-new' },
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('adds a new copy to an existing emerging wave', async () => {
    prisma.smsMessage.findMany.mockResolvedValue([{ id: 'm3', body }]);
    prisma.campaignCluster.findMany.mockResolvedValue([
      {
        id: 'w1',
        messages: [
          { id: 'm1', body },
          { id: 'm2', body },
        ],
      },
    ]);
    prisma.smsMessage.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.run()).resolves.toEqual({
      candidates: 1,
      attached: 1,
      newWaves: 0,
    });
    expect(prisma.smsMessage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m3'] }, clusterId: null },
      data: { clusterId: 'w1', campaignMatchSource: EMERGING_MATCH_SOURCE },
    });
    expect(prisma.campaignCluster.create).not.toHaveBeenCalled();
  });

  it('runs one grouping at a time', async () => {
    prisma.smsMessage.findMany.mockResolvedValue([]);
    const [a, b] = [service.run(), service.run()];
    await Promise.all([a, b]);
    expect(prisma.smsMessage.findMany).toHaveBeenCalledTimes(1);
  });
});
