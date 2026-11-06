import { Test, TestingModule } from '@nestjs/testing';

import { RetrainingController } from './retraining.controller';
import { RetrainingService } from './retraining.service';

const mockService = {
  triggerRetrain: jest.fn(),
  status: jest.fn(),
  listJobs: jest.fn(),
  listInvestigations: jest.fn(),
  openInvestigation: jest.fn(),
  updateInvestigation: jest.fn(),
  retrainForInvestigation: jest.fn(),
};

const req = { user: { userId: 'admin-1' } };

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

  it('trigger records a manual request for the acting Admin', async () => {
    const job = { id: 'job-1', status: 'ACCEPTED' };
    mockService.triggerRetrain.mockResolvedValue(job);

    const result = await controller.trigger(req);

    expect(mockService.triggerRetrain).toHaveBeenCalledWith(
      'manual',
      'admin-1',
    );
    expect(result).toEqual({ triggered: true, reason: 'manual', job });
  });

  it('status evaluates the signal without firing retraining', async () => {
    const status = {
      triggered: false,
      reason: '',
      validatedCount: 12,
      currentF1: 0.9438,
      drift: false,
      enabled: false,
      thresholds: {},
    };
    mockService.status.mockResolvedValue(status);

    const result = await controller.status();

    expect(mockService.status).toHaveBeenCalled();
    expect(mockService.triggerRetrain).not.toHaveBeenCalled();
    expect(result).toEqual(status);
  });

  it('opens an investigation for the acting Admin', async () => {
    await controller.open({ notes: 'Scores dipped after holiday' }, req);
    expect(mockService.openInvestigation).toHaveBeenCalledWith(
      'admin-1',
      'Scores dipped after holiday',
    );
  });

  it('links retraining to an investigation', async () => {
    await controller.retrain('inv-1', req);
    expect(mockService.retrainForInvestigation).toHaveBeenCalledWith(
      'inv-1',
      'admin-1',
    );
  });
});
