import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('summarize', () => {
    it('maps a successful AI-service response to camelCase', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: 'Your order has shipped.',
          sentence_count: 1,
          source_message_count: 3,
          truncated: true,
        }),
      });

      const result = await service.summarize(['a', 'b', 'c'], 2);

      expect(result).toEqual({
        summary: 'Your order has shipped.',
        sentenceCount: 1,
        sourceMessageCount: 3,
        truncated: true,
      });
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/summarize');
      expect(JSON.parse(options.body)).toEqual({
        messages: ['a', 'b', 'c'],
        max_sentences: 2,
      });
    });

    it('omits max_sentences when not provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: '',
          sentence_count: 0,
          source_message_count: 1,
          truncated: false,
        }),
      });

      await service.summarize(['hello']);

      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ messages: ['hello'] });
    });

    it('throws ServiceUnavailableException when the AI service errors', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(service.summarize(['x'])).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when the AI service is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.summarize(['x'])).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
