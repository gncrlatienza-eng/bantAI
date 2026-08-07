import { Test, TestingModule } from '@nestjs/testing';

import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

describe('VerificationController', () => {
  let controller: VerificationController;
  let service: jest.Mocked<VerificationService>;

  const USER_ID = 'user-abc-001';
  const mockReq = { user: { userId: USER_ID } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: {
            verifySender: jest.fn(),
            syncContacts: jest.fn(),
            reportFraud: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
    service = module.get(VerificationService);
  });

  describe('verifySender', () => {
    it('delegates to service with userId and sender param', async () => {
      service.verifySender.mockResolvedValue({
        sender: 'GCASH',
        status: 'unknown',
        source: 'default',
        name: null,
      });

      const result = await controller.verifySender(mockReq, 'GCASH');

      expect(service.verifySender).toHaveBeenCalledWith(USER_ID, 'GCASH');
      expect(result).toMatchObject({ sender: 'GCASH', status: 'unknown' });
    });

    it('passes alphanumeric sender IDs unchanged', async () => {
      service.verifySender.mockResolvedValue({
        sender: 'BDO-ALERT',
        status: 'unknown',
        source: 'default',
        name: null,
      });

      await controller.verifySender(mockReq, 'BDO-ALERT');

      expect(service.verifySender).toHaveBeenCalledWith(USER_ID, 'BDO-ALERT');
    });
  });

  describe('syncContacts', () => {
    it('delegates to service with userId and contacts array', async () => {
      const contacts = [
        { phone: '09171234567', name: 'Maria Santos' },
        { phone: '09281234567' },
      ];
      service.syncContacts.mockResolvedValue({ synced: 2 });

      const result = await controller.syncContacts(mockReq, { contacts });

      expect(service.syncContacts).toHaveBeenCalledWith(USER_ID, contacts);
      expect(result).toEqual({ synced: 2 });
    });
  });

  describe('reportFraud', () => {
    it('delegates to service with sender from body', async () => {
      service.reportFraud.mockResolvedValue({
        sender: 'SCAMMER',
        status: 'fraud',
      });

      const result = await controller.reportFraud({ sender: 'SCAMMER' });

      expect(service.reportFraud).toHaveBeenCalledWith('SCAMMER');
      expect(result).toMatchObject({ sender: 'SCAMMER', status: 'fraud' });
    });
  });
});
