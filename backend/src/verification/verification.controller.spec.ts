import { VerificationController } from './verification.controller';
import { PATH_METADATA } from '@nestjs/common/constants';

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

  it('registers pending reports before the sender parameter route', () => {
    const methods = Object.getOwnPropertyNames(
      VerificationController.prototype,
    );
    expect(methods.indexOf('pendingFraudReports')).toBeLessThan(
      methods.indexOf('verifySender'),
    );
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        VerificationController.prototype.pendingFraudReports,
      ),
    ).toBe('sender/pending-reports');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        VerificationController.prototype.verifySender,
      ),
    ).toBe('sender/:sender');
  });
});
