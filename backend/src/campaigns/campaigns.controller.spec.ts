import { Test, TestingModule } from '@nestjs/testing';

import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

const mockCampaignsService: Partial<CampaignsService> = {
  findAll:              jest.fn().mockResolvedValue([]),
  findOne:              jest.fn().mockResolvedValue({}),
  create:               jest.fn().mockResolvedValue({}),
  addDomains:           jest.fn().mockResolvedValue({}),
  deactivate:           jest.fn().mockResolvedValue({}),
};

describe('CampaignsController', () => {
  let controller: CampaignsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: mockCampaignsService }],
    }).compile();

    controller = module.get<CampaignsController>(CampaignsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll delegates to service', () => {
    controller.findAll();
    expect(mockCampaignsService.findAll).toHaveBeenCalled();
  });

  it('findOne delegates to service with id', () => {
    controller.findOne('c1');
    expect(mockCampaignsService.findOne).toHaveBeenCalledWith('c1');
  });

  it('deactivate delegates to service with id', () => {
    controller.deactivate('c1');
    expect(mockCampaignsService.deactivate).toHaveBeenCalledWith('c1');
  });
});
