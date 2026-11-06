import { Test, TestingModule } from '@nestjs/testing';

import { AiModelsKeyGuard } from '../auth/guards/api-key.guard';
import { InternalModelsController } from './internal-models.controller';
import { ModelsService } from './models.service';

const mockService = {
  findActive: jest.fn(),
  register: jest.fn(),
};

describe('InternalModelsController', () => {
  let controller: InternalModelsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalModelsController],
      providers: [{ provide: ModelsService, useValue: mockService }],
    })
      .overrideGuard(AiModelsKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InternalModelsController);
  });

  it('returns the active model version', async () => {
    mockService.findActive.mockResolvedValue({ id: 'v1', isActive: true });
    await expect(controller.findActive()).resolves.toEqual({
      id: 'v1',
      isActive: true,
    });
  });

  it('returns null (empty 200) when no version has been promoted yet', async () => {
    mockService.findActive.mockResolvedValue(null);
    await expect(controller.findActive()).resolves.toBeNull();
  });
});
