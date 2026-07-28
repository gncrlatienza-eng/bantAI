import { Test, TestingModule } from '@nestjs/testing';

import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

const mockSmsService = {
  ingest: jest.fn(),
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
});
