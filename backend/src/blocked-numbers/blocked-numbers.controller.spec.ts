import { Test, TestingModule } from '@nestjs/testing';

import { BlockedNumbersController } from './blocked-numbers.controller';
import { BlockedNumbersService } from './blocked-numbers.service';

const mockService = {
  list: jest.fn(),
  block: jest.fn(),
  unblock: jest.fn(),
};

describe('BlockedNumbersController', () => {
  let controller: BlockedNumbersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockedNumbersController],
      providers: [{ provide: BlockedNumbersService, useValue: mockService }],
    }).compile();

    controller = module.get<BlockedNumbersController>(
      BlockedNumbersController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('list delegates to the service with userId from the request', async () => {
    const req = { user: { userId: 'u1' } };
    mockService.list.mockResolvedValue([]);

    await controller.list(req);

    expect(mockService.list).toHaveBeenCalledWith('u1');
  });

  it('block delegates to the service with userId and sender', async () => {
    const req = { user: { userId: 'u1' } };
    mockService.block.mockResolvedValue({});

    await controller.block(req, { sender: '09171234567' });

    expect(mockService.block).toHaveBeenCalledWith('u1', '09171234567');
  });

  it('unblock delegates to the service with userId and the sender param', async () => {
    const req = { user: { userId: 'u1' } };
    mockService.unblock.mockResolvedValue(undefined);

    await controller.unblock(req, '09171234567');

    expect(mockService.unblock).toHaveBeenCalledWith('u1', '09171234567');
  });
});
