import { Test, TestingModule } from '@nestjs/testing';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const mockService = {
  submit: jest.fn(),
  findAll: jest.fn(),
  findPending: jest.fn(),
  validate: jest.fn(),
  reject: jest.fn(),
};

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('submit delegates to service with userId from JWT', async () => {
    const dto = { messageId: 'msg-1', reportedLabel: 'Spam' };
    mockService.submit.mockResolvedValue({ id: 'r1', status: 'Pending' });
    const req = { user: { userId: 'u1' } };

    const result = await controller.submit(req, dto);
    expect(result).toEqual({ id: 'r1', status: 'Pending' });
    expect(mockService.submit).toHaveBeenCalledWith('u1', dto);
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue([{ id: 'r1' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('findPending delegates to service', async () => {
    mockService.findPending.mockResolvedValue([]);
    await controller.findPending();
    expect(mockService.findPending).toHaveBeenCalled();
  });

  it('validate passes id and adminNote to service', async () => {
    mockService.validate.mockResolvedValue({ id: 'r1', status: 'Validated' });
    const result = await controller.validate('r1', { adminNote: 'OK' });
    expect(mockService.validate).toHaveBeenCalledWith('r1', 'OK');
    expect(result).toEqual({ id: 'r1', status: 'Validated' });
  });

  it('reject passes id and adminNote to service', async () => {
    mockService.reject.mockResolvedValue({ id: 'r1', status: 'Rejected' });
    await controller.reject('r1', { adminNote: 'wrong report' });
    expect(mockService.reject).toHaveBeenCalledWith('r1', 'wrong report');
  });
});
