import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

const mockService = {
  findAll: jest.fn(),
  findActive: jest.fn(),
  register: jest.fn(),
  promote: jest.fn(),
  rollback: jest.fn(),
};

describe('ModelsController', () => {
  let controller: ModelsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelsController],
      providers: [{ provide: ModelsService, useValue: mockService }],
    }).compile();

    controller = module.get<ModelsController>(ModelsController);
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('findActive delegates to service', async () => {
    mockService.findActive.mockResolvedValue({ id: 'v1', isActive: true });
    const result = await controller.findActive();
    expect(result).toEqual({ id: 'v1', isActive: true });
  });

  it('findActive throws NotFoundException when no active model exists', async () => {
    mockService.findActive.mockResolvedValue(null);
    await expect(controller.findActive()).rejects.toThrow(NotFoundException);
  });

  it('register delegates dto to service', async () => {
    const dto = { versionTag: 'v1.0.0', f1Score: 0.94 };
    mockService.register.mockResolvedValue({ id: 'v1', ...dto });
    const result = await controller.register(dto);
    expect(mockService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'v1', ...dto });
  });

  it('promote calls service with id', async () => {
    mockService.promote.mockResolvedValue({ id: 'v1', isActive: true });
    await controller.promote('v1');
    expect(mockService.promote).toHaveBeenCalledWith('v1');
  });

  it('rollback calls service with id', async () => {
    mockService.rollback.mockResolvedValue({ id: 'v1', isRollback: true });
    await controller.rollback('v1');
    expect(mockService.rollback).toHaveBeenCalledWith('v1');
  });
});
