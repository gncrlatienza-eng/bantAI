import { Test, TestingModule } from '@nestjs/testing';

import { SmsService } from './sms.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  smsMessage: { create: jest.fn() },
  messageFeature: { create: jest.fn() },
  classification: { create: jest.fn() },
};

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SmsService>(SmsService);
    jest.clearAllMocks();
  });

  // ── ingest ──────────────────────────────────────────────────────────────────

  describe('ingest', () => {
    const userId = 'user-1';
    const dto = {
      sender: 'GCash',
      body: 'Click https://evil.com to verify your account',
      receivedAt: '2026-07-21T08:00:00.000Z',
    };
    const savedMsg = {
      id: 'msg-1',
      userId,
      sender: dto.sender,
      body: dto.body,
    };

    beforeEach(() => {
      mockPrisma.smsMessage.create.mockResolvedValue(savedMsg);
      mockPrisma.messageFeature.create.mockResolvedValue({});
      mockPrisma.classification.create.mockResolvedValue({});
    });

    it('persists the raw SMS with correct fields', async () => {
      await service.ingest(userId, dto);

      expect(mockPrisma.smsMessage.create).toHaveBeenCalledWith({
        data: {
          userId,
          sender: dto.sender,
          body: dto.body,
          receivedAt: new Date(dto.receivedAt),
        },
      });
    });

    it('persists a MessageFeature record referencing the saved message', async () => {
      await service.ingest(userId, dto);

      expect(mockPrisma.messageFeature.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ messageId: savedMsg.id }),
        }),
      );
    });

    it('persists a Classification record referencing the saved message', async () => {
      await service.ingest(userId, dto);

      expect(mockPrisma.classification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageId: savedMsg.id,
            label: expect.any(String),
            score: expect.any(Number),
          }),
        }),
      );
    });

    it('returns messageId, classification, and action', async () => {
      const result = await service.ingest(userId, dto);

      expect(result).toMatchObject({
        messageId: savedMsg.id,
        classification: {
          label: expect.any(String),
          score: expect.any(Number),
        },
        action: expect.stringMatching(/^(blocked|alert|inbox)$/),
      });
    });

    it('writes in order: smsMessage → messageFeature → classification', async () => {
      await service.ingest(userId, dto);

      const msgOrder = mockPrisma.smsMessage.create.mock.invocationCallOrder[0];
      const featOrder =
        mockPrisma.messageFeature.create.mock.invocationCallOrder[0];
      const classOrder =
        mockPrisma.classification.create.mock.invocationCallOrder[0];
      expect(msgOrder).toBeLessThan(featOrder);
      expect(featOrder).toBeLessThan(classOrder);
    });
  });

  // ── preprocess (private) ─────────────────────────────────────────────────────

  describe('preprocess', () => {
    const preprocess = (body: string) => (service as any).preprocess(body);

    it('returns the original text unchanged for a clean message', () => {
      const { normalizedBody, maskedBody } = preprocess('Hello, how are you?');
      expect(normalizedBody).toBe('Hello, how are you?');
      expect(maskedBody).toBe('Hello, how are you?');
    });

    it('applies NFKC normalisation (ligatures → canonical form)', () => {
      // U+FB01 (ﬁ) is a ligature that NFKC decomposes to "fi"
      const { normalizedBody } = preprocess('ﬁle');
      expect(normalizedBody).toBe('file');
    });

    it('masks http URLs with [URL]', () => {
      const { maskedBody } = preprocess('Go to http://evil.com now');
      expect(maskedBody).toContain('[URL]');
      expect(maskedBody).not.toContain('http://evil.com');
    });

    it('masks https URLs with [URL]', () => {
      const { maskedBody } = preprocess(
        'Visit https://secure.example.com/path?q=1',
      );
      expect(maskedBody).toContain('[URL]');
    });

    it('masks 10–13 digit strings as [PHONE]', () => {
      const { maskedBody } = preprocess('Call 09171234567 for details');
      expect(maskedBody).toContain('[PHONE]');
      expect(maskedBody).not.toContain('09171234567');
    });

    it('masks 4–8 digit strings as [OTP]', () => {
      const { maskedBody } = preprocess('Your code is 123456');
      expect(maskedBody).toContain('[OTP]');
      expect(maskedBody).not.toContain('123456');
    });

    it('masks ₱ amounts as [AMOUNT]', () => {
      const { maskedBody } = preprocess('You won ₱5,000.00 in our promo');
      expect(maskedBody).toContain('[AMOUNT]');
      expect(maskedBody).not.toContain('₱5,000.00');
    });

    it('masks ₱ amounts without decimals', () => {
      const { maskedBody } = preprocess('Transfer ₱500 immediately');
      expect(maskedBody).toContain('[AMOUNT]');
    });

    it('masks multiple patterns in one message', () => {
      const { maskedBody } = preprocess(
        'Click https://x.com, your code 654321, reward ₱1,000',
      );
      expect(maskedBody).toContain('[URL]');
      expect(maskedBody).toContain('[OTP]');
      expect(maskedBody).toContain('[AMOUNT]');
    });
  });

  // ── classify (private) ───────────────────────────────────────────────────────

  describe('classify', () => {
    const classify = (body: string) => (service as any).classify(body);

    it('returns "Unknown" and low score for a clean message', () => {
      const { label, score } = classify('Kumain ka na ba?');
      expect(label).toBe('Unknown');
      expect(score).toBeLessThan(0.5);
    });

    it('returns "Suspicious" when score is in 0.5–0.89 range', () => {
      // 4 of 8 keywords → score 0.5
      const { label, score } = classify('verify locked click prize');
      expect(label).toBe('Suspicious');
      expect(score).toBeGreaterThanOrEqual(0.5);
      expect(score).toBeLessThan(0.9);
    });

    it('returns "Likely Smishing" when all keywords are present', () => {
      const allKw = '[URL] verify locked click prize won gcash account';
      const { label, score } = classify(allKw);
      expect(label).toBe('Likely Smishing');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('caps score at 0.99 regardless of keyword count', () => {
      const spam =
        '[URL] verify locked click prize won gcash account extra extra extra';
      const { score } = classify(spam);
      expect(score).toBeLessThanOrEqual(0.99);
    });

    it('is case-insensitive for keyword matching', () => {
      const { score: lower } = classify('verify');
      const { score: upper } = classify('VERIFY');
      expect(lower).toBe(upper);
    });
  });

  // ── route (private) ──────────────────────────────────────────────────────────

  describe('route', () => {
    const route = (score: number) => (service as any).route(score);

    it('returns "inbox" for score below 0.5', () => {
      expect(route(0)).toBe('inbox');
      expect(route(0.49)).toBe('inbox');
    });

    it('returns "alert" for score exactly 0.5', () => {
      expect(route(0.5)).toBe('alert');
    });

    it('returns "alert" for score in 0.5–0.89', () => {
      expect(route(0.75)).toBe('alert');
      expect(route(0.89)).toBe('alert');
    });

    it('returns "blocked" for score exactly 0.9', () => {
      expect(route(0.9)).toBe('blocked');
    });

    it('returns "blocked" for score above 0.9', () => {
      expect(route(0.99)).toBe('blocked');
      expect(route(1.0)).toBe('blocked');
    });
  });
});
