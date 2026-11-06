import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmsAdminController } from './sms-admin.controller';
import { SmsService } from './sms.service';

describe('SmsAdminController', () => {
  const smsService = {
    getAdminClassifications: jest.fn(),
    getAdminClassificationHistory: jest.fn(),
    getAdminMobileSync: jest.fn(),
  };
  let controller: SmsAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmsAdminController],
      providers: [{ provide: SmsService, useValue: smsService }],
    }).compile();
    controller = module.get(SmsAdminController);
  });

  it('is an admin-only classification route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SmsAdminController)).toBe(
      'admin/classifications',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, SmsAdminController)).toEqual([
      JwtAuthGuard,
      AdminGuard,
    ]);
  });

  it('delegates the privacy-minimized list to SmsService', async () => {
    const expected = [{ id: 'c1', label: 'Scam', alertStatus: 'Pending' }];
    smsService.getAdminClassifications.mockResolvedValue(expected);

    await expect(controller.getClassifications()).resolves.toEqual(expected);
    expect(smsService.getAdminClassifications).toHaveBeenCalledTimes(1);
  });

  it('delegates the aggregate mobile-sync overview to SmsService', async () => {
    const expected = {
      totalMessages: 1,
      syncedAccounts: 1,
      scamCount: 1,
      recent: [],
    };
    smsService.getAdminMobileSync.mockResolvedValue(expected);

    await expect(controller.getMobileSync()).resolves.toEqual(expected);
    expect(smsService.getAdminMobileSync).toHaveBeenCalledTimes(1);
  });

  it('delegates filtered history with a bounded page size', async () => {
    const expected = { items: [{ id: 'c1', label: 'Scam' }], nextCursor: null };
    smsService.getAdminClassificationHistory.mockResolvedValue(expected);
    await expect(
      controller.getHistory('threats', undefined, '50'),
    ).resolves.toEqual(expected);
    expect(smsService.getAdminClassificationHistory).toHaveBeenCalledWith({
      label: 'threats',
      cursor: undefined,
      limit: 50,
    });
  });
});
