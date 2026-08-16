import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let service: { summarize: jest.Mock };

  beforeEach(async () => {
    service = { summarize: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: service }],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('summarize', () => {
    it('delegates to AiService.summarize with the dto fields', async () => {
      service.summarize.mockResolvedValue({
        summary: 'ok',
        sentenceCount: 1,
        sourceMessageCount: 1,
        truncated: false,
      });

      const result = await controller.summarize({
        messages: ['hi'],
        maxSentences: 2,
      });

      expect(service.summarize).toHaveBeenCalledWith(['hi'], 2);
      expect(result).toEqual({
        summary: 'ok',
        sentenceCount: 1,
        sourceMessageCount: 1,
        truncated: false,
      });
    });
  });
});
