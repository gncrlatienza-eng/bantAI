import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { VerificationService } from './verification.service';

const mockPrisma = {
  contact: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  senderVerificationCache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    jest.clearAllMocks();

    // Default: sender not in contacts, not in cache
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.senderVerificationCache.findUnique.mockResolvedValue(null);
    mockPrisma.senderVerificationCache.upsert.mockResolvedValue({});
    mockPrisma.contact.upsert.mockResolvedValue({});
  });

  const userId = 'user-1';

  // ── verifySender ─────────────────────────────────────────────────────────────

  describe('verifySender', () => {
    it('returns verified+contact when sender is in user contacts', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        userId,
        phone: '09171234567',
        name: 'Nanay',
      });

      const result = await service.verifySender(userId, '09171234567');

      expect(result).toEqual({
        sender: '09171234567',
        status: 'verified',
        source: 'contact',
        name: 'Nanay',
      });
    });

    it('returns null name when contact has no display name', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        userId,
        phone: '09171234567',
        name: null,
      });

      const result = await service.verifySender(userId, '09171234567');
      expect(result.name).toBeNull();
    });

    it('does not check the cache when sender is found in contacts', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        phone: '09171234567',
        name: null,
      });

      await service.verifySender(userId, '09171234567');

      expect(
        mockPrisma.senderVerificationCache.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('returns cached status when cache entry exists and is not expired', async () => {
      const future = new Date(Date.now() + 60_000);
      mockPrisma.senderVerificationCache.findUnique.mockResolvedValue({
        sender: '09171234567',
        status: 'fraud',
        source: 'user-report',
        expiresAt: future,
      });

      const result = await service.verifySender(userId, '09171234567');

      expect(result).toMatchObject({ status: 'fraud', source: 'user-report' });
      expect(mockPrisma.senderVerificationCache.upsert).not.toHaveBeenCalled();
    });

    it('falls through to unknown when cache entry is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockPrisma.senderVerificationCache.findUnique.mockResolvedValue({
        sender: '09171234567',
        status: 'fraud',
        source: 'user-report',
        expiresAt: past,
      });

      const result = await service.verifySender(userId, '09171234567');

      expect(result.status).toBe('unknown');
      expect(mockPrisma.senderVerificationCache.upsert).toHaveBeenCalled();
    });

    it('returns unknown and upserts cache when sender has no contact and no cache', async () => {
      const result = await service.verifySender(userId, '09171234567');

      expect(result).toMatchObject({ status: 'unknown', source: 'default' });
      expect(mockPrisma.senderVerificationCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sender: '09171234567' },
          create: expect.objectContaining({
            status: 'unknown',
            source: 'default',
          }),
        }),
      );
    });

    it('normalizes +639XXXXXXXXX to 09XXXXXXXXX before DB lookup', async () => {
      await service.verifySender(userId, '+639171234567');

      expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
        where: { userId_phone: { userId, phone: '09171234567' } },
      });
    });

    it('lowercases alphanumeric sender IDs (e.g. "GCash")', async () => {
      await service.verifySender(userId, 'GCash');

      expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
        where: { userId_phone: { userId, phone: 'gcash' } },
      });
    });
  });

  // ── syncContacts ──────────────────────────────────────────────────────────────

  describe('syncContacts', () => {
    it('upserts each contact and returns synced count', async () => {
      const contacts = [
        { phone: '09171234567', name: 'Tatay' },
        { phone: '09181234567', name: 'Nanay' },
      ];

      const result = await service.syncContacts(userId, contacts);

      expect(result).toEqual({ synced: 2 });
      expect(mockPrisma.contact.upsert).toHaveBeenCalledTimes(2);
    });

    it('upserts with normalized phone numbers', async () => {
      await service.syncContacts(userId, [
        { phone: '+639171234567', name: 'Tatay' },
      ]);

      expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_phone: { userId, phone: '09171234567' } },
          create: expect.objectContaining({ phone: '09171234567' }),
        }),
      );
    });

    it('uses null when name is not provided', async () => {
      await service.syncContacts(userId, [{ phone: '09171234567' }]);

      expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: null }),
        }),
      );
    });

    it('returns synced: 0 for an empty contacts list', async () => {
      const result = await service.syncContacts(userId, []);
      expect(result).toEqual({ synced: 0 });
      expect(mockPrisma.contact.upsert).not.toHaveBeenCalled();
    });
  });

  // ── reportFraud ───────────────────────────────────────────────────────────────

  describe('reportFraud', () => {
    it('upserts fraud status with user-report source', async () => {
      await service.reportFraud('09171234567');

      expect(mockPrisma.senderVerificationCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sender: '09171234567' },
          create: expect.objectContaining({
            status: 'fraud',
            source: 'user-report',
          }),
          update: expect.objectContaining({
            status: 'fraud',
            source: 'user-report',
          }),
        }),
      );
    });

    it('returns sender and fraud status', async () => {
      const result = await service.reportFraud('09171234567');
      expect(result).toEqual({ sender: '09171234567', status: 'fraud' });
    });

    it('normalizes sender before upserting', async () => {
      await service.reportFraud('+639171234567');

      expect(mockPrisma.senderVerificationCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sender: '09171234567' },
        }),
      );
    });

    it('sets a 30-day expiry on fraud reports', async () => {
      const before = Date.now();
      await service.reportFraud('09171234567');
      const after = Date.now();

      const call = mockPrisma.senderVerificationCache.upsert.mock.calls[0][0];
      const expiresAt: Date = call.create.expiresAt;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + thirtyDaysMs - 100,
      );
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        after + thirtyDaysMs + 100,
      );
    });
  });

  // ── normalizePhone (private, tested through public methods) ───────────────────

  describe('normalizePhone (via verifySender)', () => {
    const lookup = async (phone: string) => {
      await service.verifySender(userId, phone);
      const call = mockPrisma.contact.findUnique.mock.calls[0][0];
      return call.where.userId_phone.phone as string;
    };

    it('leaves 09XXXXXXXXX unchanged', async () => {
      expect(await lookup('09171234567')).toBe('09171234567');
    });

    it('converts +639XXXXXXXXX to 09XXXXXXXXX', async () => {
      expect(await lookup('+639171234567')).toBe('09171234567');
    });

    it('lowercases alphabetic sender IDs without stripping characters', async () => {
      expect(await lookup('PLDT')).toBe('pldt');
    });

    it('strips non-digit characters from numeric-only strings', async () => {
      expect(await lookup('0917-123-4567')).toBe('09171234567');
    });
  });
});
