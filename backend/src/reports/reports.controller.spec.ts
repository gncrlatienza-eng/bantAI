import { Test, TestingModule } from '@nestjs/testing';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const mockService = {
  submit: jest.fn(),
  findAll: jest.fn(),
  findMine: jest.fn(),
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

  it("findMine lists only the JWT user's own reports", async () => {
    mockService.findMine.mockResolvedValue([{ id: 'r1' }]);
    const result = await controller.findMine({ user: { userId: 'u1' } });
    expect(result).toEqual([{ id: 'r1' }]);
    expect(mockService.findMine).toHaveBeenCalledWith('u1');
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue([{ id: 'r1' }]);
    const result = await controller.findAll({ user: { userId: 'admin-1' } });
    expect(result).toEqual([{ id: 'r1' }]);
    expect(mockService.findAll).toHaveBeenCalledWith('admin-1');
  });

  it('findPending delegates to service', async () => {
    mockService.findPending.mockResolvedValue([]);
    await controller.findPending({ user: { userId: 'admin-1' } });
    expect(mockService.findPending).toHaveBeenCalledWith('admin-1');
  });

  it('validate passes id and adminNote to service', async () => {
    mockService.validate.mockResolvedValue({ id: 'r1', status: 'Validated' });
    const result = await controller.validate(
      { user: { userId: 'admin-1' } },
      'r1',
      { adminNote: 'OK' },
    );
    expect(mockService.validate).toHaveBeenCalledWith('r1', 'admin-1', 'OK');
    expect(result).toEqual({ id: 'r1', status: 'Validated' });
  });

  it('reject passes id and adminNote to service', async () => {
    mockService.reject.mockResolvedValue({ id: 'r1', status: 'Rejected' });
    await controller.reject({ user: { userId: 'admin-1' } }, 'r1', {
      adminNote: 'wrong report',
    });
    expect(mockService.reject).toHaveBeenCalledWith(
      'r1',
      'admin-1',
      'wrong report',
    );
  });
});
