import { CampaignsController } from './campaigns.controller';

describe('CampaignsController', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    deactivate: jest.fn(),
    findCentroids: jest.fn(),
    findByDomains: jest.fn(),
  };
  const controller = new CampaignsController(service as any);

  beforeEach(() => jest.clearAllMocks());

  it('scopes campaign-message details to the authenticated user', () => {
    controller.findOne({ user: { userId: 'user-1' } }, 'campaign-1');
    expect(service.findOne).toHaveBeenCalledWith('campaign-1', 'user-1');
  });

  it('uses the same implementation for the separately guarded machine deactivation route', () => {
    controller.deactivateInternal('campaign-1');
    expect(service.deactivate).toHaveBeenCalledWith('campaign-1');
  });
});
