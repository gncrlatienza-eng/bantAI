import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

const mockService = {
  findAll: jest.fn(),
  findActive: jest.fn(),
  getServingStatus: jest.fn(),
  register: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  requestActivation: jest.fn(),
  confirmActivation: jest.fn(),
  markActivationFailed: jest.fn(),
};

const req = { user: { userId: 'admin-1' } };

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

  it('getServingStatus delegates to service', async () => {
    const status = {
      status: 'ready',
      modelReady: true,
      versionTag: 'v1',
      registryVersionTag: 'v1',
      matchesRegistry: true,
    };
    mockService.getServingStatus.mockResolvedValue(status);

    await expect(controller.getServingStatus()).resolves.toEqual(status);
    expect(mockService.getServingStatus).toHaveBeenCalled();
  });

  it('register delegates dto to service', async () => {
    const dto = { versionTag: 'v1.0.0', f1Score: 0.94 };
    mockService.register.mockResolvedValue({ id: 'v1', ...dto });
    const result = await controller.register(dto);
    expect(mockService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'v1', ...dto });
  });

  it('approve passes the review note and actor', async () => {
    await controller.approve('v1', { note: 'Beats baseline' }, req);
    expect(mockService.approve).toHaveBeenCalledWith(
      'v1',
      'Beats baseline',
      'admin-1',
    );
  });

  it('reject passes the review note and actor', async () => {
    await controller.reject('v1', { note: 'Regresses on Scam' }, req);
    expect(mockService.reject).toHaveBeenCalledWith(
      'v1',
      'Regresses on Scam',
      'admin-1',
    );
  });

  it('deploy only records a deployment request', async () => {
    await controller.requestDeployment('v1', { note: 'Release window' }, req);
    expect(mockService.requestActivation).toHaveBeenCalledWith(
      'v1',
      'Release window',
      'admin-1',
    );
  });

  it('confirm-deployment delegates to the runtime check', async () => {
    await controller.confirmDeployment('v1', req);
    expect(mockService.confirmActivation).toHaveBeenCalledWith('v1', 'admin-1');
  });

  it('deployment-failed records the reason', async () => {
    await controller.deploymentFailed(
      'v1',
      { note: 'Bundle hash mismatch' },
      req,
    );
    expect(mockService.markActivationFailed).toHaveBeenCalledWith(
      'v1',
      'Bundle hash mismatch',
      'admin-1',
    );
  });
});
