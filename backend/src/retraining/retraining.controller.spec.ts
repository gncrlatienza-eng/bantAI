import { Test, TestingModule } from '@nestjs/testing';

import { RetrainingController } from './retraining.controller';
import { RetrainingService } from './retraining.service';

const mockService = {
  triggerRetrain: jest.fn(),
  evaluateTriggers: jest.fn(),
};

describe('RetrainingController', () => {
  let controller: RetrainingController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetrainingController],
      providers: [{ provide: RetrainingService, useValue: mockService }],
    }).compile();

    controller = module.get<RetrainingController>(RetrainingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('trigger calls triggerRetrain with "manual" and returns triggered:true', async () => {
    mockService.triggerRetrain.mockResolvedValue(undefined);

    const result = await controller.trigger();

    expect(mockService.triggerRetrain).toHaveBeenCalledWith('manual');
    expect(result).toEqual({ triggered: true, reason: 'manual' });
  });

  it('status delegates to evaluateTriggers without firing retraining', async () => {
    const evalResult = {
      triggered: false,
      reason: '',
      validatedCount: 12,
      currentF1: 0.9438,
      drift: false,
    };
    mockService.evaluateTriggers.mockResolvedValue(evalResult);

    const result = await controller.status();

    expect(mockService.evaluateTriggers).toHaveBeenCalled();
    expect(mockService.triggerRetrain).not.toHaveBeenCalled();
    expect(result).toEqual(evalResult);
  });
});
