import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

const mockService = { getSummary: jest.fn() };

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
});
