import { CampaignsController } from './campaigns.controller';
import { AuthAudience } from '../auth/constants';

describe('CampaignsController', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findShieldOne: jest.fn(),
    findAdminOne: jest.fn(),
    findShieldAll: jest.fn(),
    findShieldMaskedMessages: jest.fn(),
    approveMaskedMessage: jest.fn(),
    create: jest.fn(),
    deactivate: jest.fn(),
    findCentroids: jest.fn(),
    findByDomains: jest.fn(),
  };
  const controller = new CampaignsController(service as any, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('scopes campaign-message details to the authenticated user', () => {
    controller.findOne(
      { user: { userId: 'user-1', audience: AuthAudience.MOBILE } },
      'campaign-1',
    );
    expect(service.findOne).toHaveBeenCalledWith('campaign-1', 'user-1');
  });

  it('routes Shield detail to its explicit public serializer', () => {
    controller.findOne(
      { user: { userId: 'shield-1', audience: AuthAudience.CLIENT } },
      'campaign-1',
    );
    expect(service.findShieldOne).toHaveBeenCalledWith('campaign-1');
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('uses the same implementation for the separately guarded machine deactivation route', () => {
    controller.deactivateInternal('campaign-1');
    expect(service.deactivate).toHaveBeenCalledWith('campaign-1');
  });

  it('attributes human deactivation to the Admin actor', () => {
    controller.deactivate('campaign-1', { user: { userId: 'admin-1' } });
    expect(service.deactivate).toHaveBeenCalledWith('campaign-1', 'admin-1');
  });

  it('routes Admin detail to the audited internal review path', () => {
    controller.findOne(
      { user: { userId: 'admin-1', audience: AuthAudience.ADMIN } },
      'campaign-1',
    );
    expect(service.findAdminOne).toHaveBeenCalledWith('campaign-1', 'admin-1');
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('attributes masked-message approval to the Admin actor', () => {
    const dto = { text: '[BRAND]: Verify [ACCOUNT] at [URL].' };
    controller.approveMaskedMessage(
      { user: { userId: 'admin-1' } },
      'campaign-1',
      dto,
    );
    expect(service.approveMaskedMessage).toHaveBeenCalledWith(
      'campaign-1',
      dto,
      'admin-1',
    );
  });
});
