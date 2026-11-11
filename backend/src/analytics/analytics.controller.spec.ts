import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

const mockService = {
  getSummary: jest.fn(),
  getAdminThreatTrends: jest.fn(),
};

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getSummary delegates to service', async () => {
    const summary = {
      totalMessages: 10,
      classificationsByLabel: { Ham: 8, Scam: 2 },
      alertsByStatus: { Pending: 2 },
      totalReports: 1,
    };
    mockService.getSummary.mockResolvedValue(summary);
    const result = await controller.getSummary();
    expect(mockService.getSummary).toHaveBeenCalled();
    expect(result).toEqual(summary);
  });

  it('getAdminTrends delegates to service with query params', async () => {
    const trends = {
      range: '14d',
      interval: 'day',
      startDate: '2026-10-26T00:00:00.000Z',
      endDate: '2026-11-09T00:00:00.000Z',
      categories: ['Gambling'],
      categoryTotals: { Gambling: 5 },
      totals: { scam: 5, spam: 0, ham: 10, total: 15 },
      timeline: [],
    };
    mockService.getAdminThreatTrends.mockResolvedValue(trends);
    const result = await controller.getAdminTrends('14d', 'day');
    expect(mockService.getAdminThreatTrends).toHaveBeenCalledWith({
      range: '14d',
      interval: 'day',
    });
    expect(result).toEqual(trends);
  });
});
