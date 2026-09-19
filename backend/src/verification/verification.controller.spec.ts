import { VerificationController } from './verification.controller';

describe('VerificationController', () => {
  const service = {
    reportFraud: jest.fn(),
    findPendingFraudReports: jest.fn(),
    confirmFraud: jest.fn(),
  };
  const controller = new VerificationController(service as any);

  beforeEach(() => jest.clearAllMocks());

  it('passes the authenticated reporter identity to fraud reporting', () => {
    controller.reportFraud(
      { user: { userId: 'u1' } },
      { sender: '09171234567' },
    );
    expect(service.reportFraud).toHaveBeenCalledWith('u1', '09171234567');
  });

  it('passes both authenticated reviewer and reason to moderation', () => {
    controller.confirmFraud(
      { user: { userId: 'admin' } },
      { reportId: 'r1', reason: 'two independent reports reviewed' },
    );
    expect(service.confirmFraud).toHaveBeenCalledWith(
      'r1',
      'admin',
      'two independent reports reviewed',
    );
  });
});
