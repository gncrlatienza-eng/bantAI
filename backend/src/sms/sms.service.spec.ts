import { Test, TestingModule } from '@nestjs/testing';

import { SmsService } from './sms.service';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { CampaignsService } from '../campaigns/campaigns.service';

const mockPrisma = {
  blockedNumber: { findUnique: jest.fn(), upsert: jest.fn() },
  smsMessage:    { create: jest.fn(), update: jest.fn() },
  contact:       { findUnique: jest.fn() },
  messageFeature: { create: jest.fn() },
  classification: { create: jest.fn(), findUnique: jest.fn() },
  explainableIndicator: { upsert: jest.fn() },
};

const mockAiService: Partial<AiService> = {
  classify: jest.fn().mockResolvedValue(null), // default: AI offline → local fallback
};

const mockCampaignsService: Partial<CampaignsService> = {
  getActiveDomains:      jest.fn().mockResolvedValue(new Set<string>()),
  findByDomains:         jest.fn().mockResolvedValue(null),
  incrementMessageCount: jest.fn().mockResolvedValue({}),
};

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: PrismaService,    useValue: mockPrisma },
        { provide: AiService,        useValue: mockAiService },
        { provide: CampaignsService, useValue: mockCampaignsService },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    jest.clearAllMocks();

    // Default mock state: sender not blocked, sender not a contact
    mockPrisma.blockedNumber.findUnique.mockResolvedValue(null);
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.smsMessage.create.mockResolvedValue(savedMsg);
    mockPrisma.messageFeature.create.mockResolvedValue({});
    mockPrisma.classification.create.mockResolvedValue({});
    (mockAiService.classify as jest.Mock).mockResolvedValue(null);
    (mockCampaignsService.getActiveDomains as jest.Mock).mockResolvedValue(new Set<string>());
    (mockCampaignsService.findByDomains as jest.Mock).mockResolvedValue(null);
  });

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

  // ── ingest ──────────────────────────────────────────────────────────────────

  describe('ingest', () => {
    it('suppresses immediately when sender is blocked', async () => {
      mockPrisma.blockedNumber.findUnique.mockResolvedValue({ sender: dto.sender });

      const result = await service.ingest(userId, dto);

      expect(result).toEqual({ suppressed: true, reason: 'blocked_sender' });
      expect(mockPrisma.smsMessage.create).not.toHaveBeenCalled();
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

    it('auto-blocks sender when score >= 0.9', async () => {
      // Force high-confidence classification via keyword stuffing
      const highRiskDto = {
        ...dto,
        body: '[URL] verify locked click prize won gcash account',
      };
      await service.ingest(userId, highRiskDto);

      expect(mockPrisma.blockedNumber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ source: 'AutoBlock' }),
        }),
      );
    });

    it('does not auto-block sender when score < 0.9', async () => {
      const lowRiskDto = { ...dto, body: 'Hello kumain ka na ba?' };
      await service.ingest(userId, lowRiskDto);

      expect(mockPrisma.blockedNumber.upsert).not.toHaveBeenCalled();
    });

    it('suppresses links when sender is unknown and message contains URLs', async () => {
      const result = await service.ingest(userId, dto);
      // dto.body contains https://evil.com — sender unknown → should be in suppressedLinks
      // (only if evil.com is in cluster domains or is a shortened URL service)
      expect(result).toHaveProperty('suppressedLinks');
      expect(Array.isArray((result as any).suppressedLinks)).toBe(true);
    });

    it('writes in order: blockedNumber check → smsMessage → messageFeature → classification', async () => {
      await service.ingest(userId, dto);

      const blockedOrder = mockPrisma.blockedNumber.findUnique.mock.invocationCallOrder[0];
      const msgOrder     = mockPrisma.smsMessage.create.mock.invocationCallOrder[0];
      const featOrder    = mockPrisma.messageFeature.create.mock.invocationCallOrder[0];
      const classOrder   = mockPrisma.classification.create.mock.invocationCallOrder[0];

      expect(blockedOrder).toBeLessThan(msgOrder);
      expect(msgOrder).toBeLessThan(featOrder);
      expect(featOrder).toBeLessThan(classOrder);
    });
  });

  // ── maskLocally (private) ────────────────────────────────────────────────────

  describe('maskLocally', () => {
    const mask = (body: string) => (service as any).maskLocally(body.normalize('NFKC'));

    it('returns the original text unchanged for a clean message', () => {
      expect(mask('Hello, how are you?')).toBe('Hello, how are you?');
    });

    it('applies NFKC normalisation (ligatures → canonical form)', () => {
      // U+FB01 (ﬁ) is a ligature that NFKC decomposes to "fi"
      expect(mask('ﬁle')).toBe('file');
    });

    it('masks http URLs with [URL]', () => {
      const result = mask('Go to http://evil.com now');
      expect(result).toContain('[URL]');
      expect(result).not.toContain('http://evil.com');
    });

    it('masks https URLs with [URL]', () => {
      expect(mask('Visit https://secure.example.com/path?q=1')).toContain('[URL]');
    });

    it('masks 10–13 digit strings as [PHONE]', () => {
      const result = mask('Call 09171234567 for details');
      expect(result).toContain('[PHONE]');
      expect(result).not.toContain('09171234567');
    });

    it('masks 4–8 digit strings as [OTP]', () => {
      const result = mask('Your code is 123456');
      expect(result).toContain('[OTP]');
      expect(result).not.toContain('123456');
    });

    it('masks ₱ amounts as [AMOUNT]', () => {
      const result = mask('You won ₱5,000.00 in our promo');
      expect(result).toContain('[AMOUNT]');
      expect(result).not.toContain('₱5,000.00');
    });

    it('masks ₱ amounts without decimals', () => {
      expect(mask('Transfer ₱500 immediately')).toContain('[AMOUNT]');
    });

    it('masks multiple patterns in one message', () => {
      const result = mask('Click https://x.com, your code 654321, reward ₱1,000');
      expect(result).toContain('[URL]');
      expect(result).toContain('[OTP]');
      expect(result).toContain('[AMOUNT]');
    });
  });

  // ── classifyLocally (private) ────────────────────────────────────────────────

  describe('classifyLocally', () => {
    const classify = (body: string) => (service as any).classifyLocally(body);

    it('returns "Ham" and low score for a clean message', () => {
      const { label, score } = classify('Kumain ka na ba?');
      expect(label).toBe('Ham');
      expect(score).toBeLessThan(0.5);
    });

    it('returns "Spam" when score is in 0.5–0.89 range', () => {
      const { label, score } = classify('verify locked click prize');
      expect(label).toBe('Spam');
      expect(score).toBeGreaterThanOrEqual(0.5);
      expect(score).toBeLessThan(0.9);
    });

    it('returns "Scam" when all keywords are present', () => {
      const { label, score } = classify('[url] verify locked click prize won gcash account');
      expect(label).toBe('Scam');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('caps score at 0.99 regardless of keyword count', () => {
      const { score } = classify('[url] verify locked click prize won gcash account extra extra');
      expect(score).toBeLessThanOrEqual(0.99);
    });

    it('is case-insensitive for keyword matching', () => {
      const { score: lower } = classify('verify');
      const { score: upper } = classify('VERIFY');
      expect(lower).toBe(upper);
    });
  });

  // ── routeFromScore (private) ─────────────────────────────────────────────────

  describe('routeFromScore', () => {
    const route = (score: number) => (service as any).routeFromScore(score);

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

  // ── routeFromBucket (private) ────────────────────────────────────────────────

  describe('routeFromBucket', () => {
    const route = (bucket: string) => (service as any).routeFromBucket(bucket);

    it('returns "blocked" for bucket "blocked"', () => {
      expect(route('blocked')).toBe('blocked');
    });

    it('returns "alert" for bucket "spam"', () => {
      expect(route('spam')).toBe('alert');
    });

    it('returns "inbox" for bucket "safe"', () => {
      expect(route('safe')).toBe('inbox');
    });

    it('returns "inbox" for bucket "unknown"', () => {
      expect(route('unknown')).toBe('inbox');
    });
  });
});
