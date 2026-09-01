import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AnalyticsService } from './analytics.service';

const mockPrisma = {
  smsMessage: { count: jest.fn() },
  classification: { groupBy: jest.fn() },
  alert: { groupBy: jest.fn() },
  userReport: { count: jest.fn() },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getSummary returns aggregated counts', async () => {
    mockPrisma.smsMessage.count.mockResolvedValue(20);
    mockPrisma.classification.groupBy.mockResolvedValue([
      { label: 'Ham', _count: { label: 15 } },
      { label: 'Scam', _count: { label: 5 } },
    ]);
    mockPrisma.alert.groupBy.mockResolvedValue([
      { status: 'Pending', _count: { status: 3 } },
      { status: 'Blocked', _count: { status: 2 } },
    ]);
    mockPrisma.userReport.count.mockResolvedValue(4);

    const result = await service.getSummary();

    expect(result).toEqual({
      totalMessages: 20,
      classificationsByLabel: { Ham: 15, Scam: 5 },
      alertsByStatus: { Pending: 3, Blocked: 2 },
      totalReports: 4,
    });
  });
});
