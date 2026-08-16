import { Test, TestingModule } from '@nestjs/testing';

import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

const mockSmsService = {
  ingest: jest.fn(),
  getAlerts: jest.fn(),
  getIndicators: jest.fn(),
  storeIndicators: jest.fn(),
};

describe('SmsController', () => {
  let controller: SmsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [{ provide: SmsService, useValue: mockSmsService }],
    }).compile();

    controller = module.get<SmsController>(SmsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates ingest to SmsService with userId from request', async () => {
    const req = { user: { userId: 'u1' } };
    const dto = {
      sender: 'Globe',
      body: 'Hello',
      receivedAt: '2026-07-21T08:00:00.000Z',
    };
    const expected = {
      messageId: 'msg-1',
      classification: { label: 'Unknown', score: 0 },
      action: 'inbox',
    };
    mockSmsService.ingest.mockResolvedValue(expected);

    const result = await controller.ingest(req, dto);

    expect(mockSmsService.ingest).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual(expected);
  });

  it('delegates getAlerts to SmsService with userId from request', async () => {
    const req = { user: { userId: 'u1' } };
    mockSmsService.getAlerts.mockResolvedValue([]);

    const result = await controller.getAlerts(req);

    expect(mockSmsService.getAlerts).toHaveBeenCalledWith('u1');
    expect(result).toEqual([]);
  });

  it('delegates getIndicators to SmsService with userId and messageId', async () => {
    const req = { user: { userId: 'u1' } };
    const expected = { indicators: [{ tag: 'Prize Lure', weight: 1.0 }] };
    mockSmsService.getIndicators.mockResolvedValue(expected);

    const result = await controller.getIndicators(req, 'msg-1');

    expect(mockSmsService.getIndicators).toHaveBeenCalledWith('u1', 'msg-1');
    expect(result).toEqual(expected);
  });

  it('delegates storeIndicators to SmsService (guarded by ApiKeyGuard)', async () => {
    const dto = { indicators: [{ tag: 'Prize Lure', weight: 1.0 }] };
    mockSmsService.storeIndicators.mockResolvedValue({});

    await controller.storeIndicators('msg-1', dto);

    expect(mockSmsService.storeIndicators).toHaveBeenCalledWith(
      'msg-1',
      dto.indicators,
    );
  });
});
