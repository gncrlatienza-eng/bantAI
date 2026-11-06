import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockPrisma = {
  $transaction: jest.fn((operation) => operation(mockPrisma)),
  campaignCluster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  shieldCampaignMessage: { create: jest.fn(), findMany: jest.fn() },
  smsMessage: { groupBy: jest.fn().mockResolvedValue([]) },
};
const mockAudit = { record: jest.fn() };

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('queries only active clusters ordered by messageCount desc', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith({
        where: { isActive: true, archivedAt: null },
        orderBy: { messageCount: 'desc' },
        select: expect.any(Object),
      });
    });
  });

  describe('Shield serialization', () => {
    it('selects only published campaign fields and omits message and centroid data', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        {
          id: 'c1',
          label: 'Reward lure',
          risk: 'HIGH',
          category: 'Brand impersonation',
          isActive: true,
          createdAt: new Date('2026-09-01'),
          updatedAt: new Date('2026-09-29'),
          summary: 'Attempts account takeover.',
          mitigation: 'Block reported domains.',
          urlDomains: ['attacker.example'],
          centroid: [0.1],
          messages: [{ body: 'never return this' }],
        },
      ]);
      const result = await service.findShieldAll();
      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publishedAt: { not: null }, archivedAt: null },
          select: expect.not.objectContaining({
            centroid: true,
            messages: true,
          }),
        }),
      );
      expect(JSON.stringify(result)).not.toContain('never return this');
      expect(JSON.stringify(result)).not.toContain('"attacker.example"');
      expect(result[0].urlDomains).toEqual(['attacker[.]example']);
      expect(result[0]).toMatchObject({ id: 'c1', observedDomainCount: 1 });
    });

    it('marks a campaign ACTIVE from its texts in the last 30 days, not the matcher flag', async () => {
      const day = 24 * 60 * 60 * 1000;
      const base = {
        label: 'Reward lure',
        risk: 'HIGH',
        category: 'Rewards / prize claim',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        summary: 's',
        mitigation: 'm',
        urlDomains: [],
      };
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        // Retired by the matcher, but texts still arriving.
        {
          ...base,
          id: 'recent',
          isActive: false,
          publishedAt: new Date('2026-01-03'),
        },
        // Matcher still on, but nothing received for months.
        {
          ...base,
          id: 'quiet',
          isActive: true,
          publishedAt: new Date('2026-01-03'),
        },
      ]);
      const lastSeen = new Date(Date.now() - 2 * day);
      mockPrisma.smsMessage.groupBy.mockResolvedValueOnce([
        {
          clusterId: 'recent',
          _min: { receivedAt: new Date('2026-08-01') },
          _max: { receivedAt: lastSeen },
        },
        {
          clusterId: 'quiet',
          _min: { receivedAt: new Date('2026-01-05') },
          _max: { receivedAt: new Date(Date.now() - 90 * day) },
        },
      ]);

      const [recent, quiet] = await service.findShieldAll();

      expect(recent).toMatchObject({
        status: 'ACTIVE',
        isActive: true,
        lastObserved: lastSeen,
        firstObserved: new Date('2026-08-01'),
      });
      expect(quiet).toMatchObject({ status: 'DORMANT', isActive: false });
    });
  });

  describe('Admin campaign management', () => {
    it('creates a dormant unpublished draft and audits its creator', async () => {
      mockPrisma.campaignCluster.create.mockResolvedValue({
        id: 'manual-1',
        isActive: false,
        publishedAt: null,
      });
      await service.createAdmin(
        {
          title: ' Review campaign ',
          summary: 'Reviewed pattern',
          risk: 'HIGH',
          category: 'Impersonation',
          mitigation: 'Block indicators',
        },
        'admin-1',
      );
      expect(mockPrisma.campaignCluster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Review campaign',
            isActive: false,
            publishedAt: null,
            urlDomains: [],
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          metadata: { campaignId: 'manual-1', source: 'ADMIN' },
        }),
        mockPrisma,
      );
    });

    it('withdraws publication when Admin changes indicators', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'c1',
        urlDomains: ['old.example'],
      });
      mockPrisma.campaignCluster.update.mockResolvedValue({ id: 'c1' });
      await service.setIndicators(
        'c1',
        { domains: ['New.Example', 'new.example'] },
        'admin-1',
      );
      expect(mockPrisma.campaignCluster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { urlDomains: ['new.example'], publishedAt: null },
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: 'admin-1' }),
        mockPrisma,
      );
    });

    it('requires matching evidence before reactivating a draft', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'manual-1',
        centroid: null,
        urlDomains: [],
      });
      await expect(service.reactivate('manual-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.campaignCluster.update).not.toHaveBeenCalled();
    });

    it('archives without deleting and withdraws Shield publication', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'c1',
        archivedAt: null,
      });
      mockPrisma.campaignCluster.update.mockResolvedValue({
        id: 'c1',
        isActive: false,
        archivedAt: new Date(),
      });
      await service.archive('c1', 'admin-1');
      expect(mockPrisma.campaignCluster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', archivedAt: null },
          data: expect.objectContaining({
            archivedAt: expect.any(Date),
            isActive: false,
            publishedAt: null,
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          metadata: {
            campaignId: 'c1',
            action: 'ARCHIVED',
            publicationReset: true,
          },
        }),
        mockPrisma,
      );
    });

    it('never reactivates an archived campaign', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'c1',
        archivedAt: new Date(),
        centroid: [0.1],
        urlDomains: [],
      });
      await expect(service.reactivate('c1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.campaignCluster.update).not.toHaveBeenCalled();
    });
  });

  describe('masked-message approval', () => {
    it('returns only approved, conservatively masked samples from a published campaign', async () => {
      mockPrisma.campaignCluster.findFirst.mockResolvedValue({
        id: 'c1',
        label: 'Campaign',
        risk: 'HIGH',
        category: 'Impersonation',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        summary: 'Account lure',
        mitigation: 'Block domain',
        urlDomains: [],
      });
      mockPrisma.shieldCampaignMessage.findMany.mockResolvedValue([
        {
          maskedText: '[BRAND]: Verify [ACCOUNT] at [URL].',
          language: 'Taglish',
          classification: 'SCAM',
          confidence: 0.96,
        },
        {
          maskedText: '[BRAND] Reymark call 09171234567',
          language: null,
          classification: null,
          confidence: null,
        },
      ]);
      const result = await service.findShieldMaskedMessages('c1');
      expect(result).toEqual([
        {
          text: '[BRAND]: Verify [ACCOUNT] at [URL].',
          language: 'Taglish',
          classification: 'SCAM',
          confidence: 0.96,
          campaignId: 'c1',
        },
      ]);
      expect(mockPrisma.shieldCampaignMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId: 'c1',
            approvedByUserId: { not: null },
          }),
          select: expect.not.objectContaining({
            approvedByUserId: true,
            id: true,
          }),
        }),
      );
    });
    it('rejects a raw SMS body before any persistence', async () => {
      await expect(
        service.approveMaskedMessage(
          'c1',
          {
            text: 'Hi Reymark, call 09171234567 about account 4812',
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.shieldCampaignMessage.create).not.toHaveBeenCalled();
    });

    it('stores only a reviewed masked example and records its approval', async () => {
      const approvedAt = new Date();
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.shieldCampaignMessage.create.mockResolvedValue({
        id: 'm1',
        campaignId: 'c1',
        approvedAt,
      });
      await expect(
        service.approveMaskedMessage(
          'c1',
          {
            text: '[BRAND]: Your [ACCOUNT] requires verification at [URL].',
            classification: 'LIKELY_SMISHING',
          },
          'admin-1',
        ),
      ).resolves.toEqual({ id: 'm1', campaignId: 'c1', approvedAt });
      expect(mockPrisma.shieldCampaignMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approvedByUserId: 'admin-1',
            maskedText:
              '[BRAND]: Your [ACCOUNT] requires verification at [URL].',
          }),
        }),
      );
      expect(
        mockPrisma.shieldCampaignMessage.create.mock.calls[0][0].data,
      ).not.toHaveProperty('rawSmsId');
    });
  });

  describe('findAllCentroids', () => {
    it('returns every active centroid without silently truncating the matcher set', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);

      await service.findAllCentroids();

      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith({
        // Emerging waves are left out so the AI sync never retires them.
        where: {
          isActive: true,
          archivedAt: null,
          OR: [{ origin: null }, { origin: { not: 'EMERGING' } }],
        },
        select: {
          id: true,
          centroid: true,
          label: true,
          urlDomains: true,
          lexicalProfile: true,
        },
      });
    });

    it('serves the versioned profile the AI domain and hybrid tiers read', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        {
          id: 'c1',
          centroid: [0.1],
          label: 'cluster-1',
          urlDomains: ['gcash-verify.ph'],
          lexicalProfile: {
            version: 1,
            shingles: ['click <url>', 'verify'],
            memberCount: 12,
          },
        },
        {
          id: 'c2',
          centroid: [0.2],
          label: null,
          urlDomains: ['bdo-help.com'],
          lexicalProfile: { version: 99, shingles: ['future'] },
        },
      ]);

      await expect(service.findAllCentroids()).resolves.toEqual([
        {
          id: 'c1',
          centroid: [0.1],
          label: 'cluster-1',
          urlDomains: ['gcash-verify.ph'],
          profileVersion: 1,
          lexical: {
            shingles: ['click <url>', 'verify'],
            domains: ['gcash-verify.ph'],
            member_count: 12,
          },
        },
        {
          id: 'c2',
          centroid: [0.2],
          label: null,
          urlDomains: ['bdo-help.com'],
          profileVersion: 1,
          // Unknown profile versions are not guessed at: domain tier only.
          lexical: {
            shingles: [],
            domains: ['bdo-help.com'],
            member_count: 0,
          },
        },
      ]);
    });
  });

  describe('create', () => {
    it('stores a de-duplicated, sorted wording profile', async () => {
      mockPrisma.campaignCluster.create.mockResolvedValue({ id: 'c1' });

      await service.create({
        label: 'cluster-1',
        category: 'Brand impersonation',
        centroid: [0.1],
        urlDomains: ['gcash-verify.ph'],
        lexical: {
          version: 1,
          shingles: ['verify', 'click <url>', 'verify'],
          memberCount: 3,
        },
      });

      expect(mockPrisma.campaignCluster.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'Brand impersonation',
          lexicalProfile: {
            version: 1,
            shingles: ['click <url>', 'verify'],
            memberCount: 3,
          },
        }),
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when cluster does not exist', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns cluster when found', async () => {
      const cluster = { id: 'c1', messages: [] };
      mockPrisma.campaignCluster.findUnique.mockResolvedValue(cluster);
      await expect(service.findOne('c1')).resolves.toEqual(cluster);
    });
  });

  describe('findAdminOne', () => {
    it('returns publication fields and audits restricted message review', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'c1',
        publishedAt: null,
        messages: [{ id: 'm1', body: '[MASKED]' }],
      });
      await service.findAdminOne('c1', 'admin-1');
      expect(mockPrisma.campaignCluster.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            publishedAt: true,
            summary: true,
            messages: expect.any(Object),
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          metadata: {
            campaignId: 'c1',
            source: 'admin-campaign-detail',
            count: 1,
          },
        }),
      );
    });
  });

  describe('addDomains', () => {
    it('throws NotFoundException when cluster does not exist', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue(null);
      await expect(service.addDomains('missing', ['evil.com'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('merges new domains with existing ones without duplicates', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue({
        id: 'c1',
        urlDomains: ['a.com'],
      });
      mockPrisma.campaignCluster.update.mockResolvedValue({});
      await service.addDomains('c1', ['a.com', 'b.com']);
      expect(mockPrisma.campaignCluster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            urlDomains: expect.arrayContaining(['a.com', 'b.com']),
            publishedAt: null,
          }),
        }),
      );
      // no duplicates
      const call = mockPrisma.campaignCluster.update.mock.calls[0][0];
      expect(
        call.data.urlDomains.filter((d: string) => d === 'a.com').length,
      ).toBe(1);
    });
  });

  describe('findByDomains', () => {
    it('returns null immediately for empty domain list', async () => {
      const result = await service.findByDomains([]);
      expect(result).toBeNull();
      expect(mockPrisma.campaignCluster.findFirst).not.toHaveBeenCalled();
    });

    it('queries active clusters with hasSome filter', async () => {
      mockPrisma.campaignCluster.findFirst.mockResolvedValue(null);
      await service.findByDomains(['evil.com']);
      expect(mockPrisma.campaignCluster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            archivedAt: null,
            urlDomains: { hasSome: ['evil.com'] },
          },
        }),
      );
    });
  });

  describe('findActiveById', () => {
    it('accepts only a backend-owned active campaign id', async () => {
      mockPrisma.campaignCluster.findFirst.mockResolvedValue({ id: 'c1' });

      await service.findActiveById('c1');

      expect(mockPrisma.campaignCluster.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', isActive: true, archivedAt: null },
        // label/category go back to the phone with the ingest response.
        select: { id: true, label: true, category: true },
      });
    });
  });

  describe('findAllInactive', () => {
    it('queries only inactive clusters ordered by updatedAt desc', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await service.findAllInactive();
      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false, archivedAt: null },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('returns an empty array when no inactive clusters exist', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await expect(service.findAllInactive()).resolves.toEqual([]);
    });
  });

  describe('admin list activity', () => {
    it('adds linked message count and last-seen from every linked message', async () => {
      const lastSeen = new Date('2026-09-04T08:00:00Z');
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        { id: 'c1', summary: null, publishedAt: null, messageCount: 0 },
        { id: 'c2', summary: null, publishedAt: null, messageCount: 0 },
      ]);
      mockPrisma.smsMessage.groupBy.mockResolvedValueOnce([
        {
          clusterId: 'c1',
          _count: { _all: 16 },
          _max: { receivedAt: lastSeen },
        },
      ]);

      const rows = await service.findAllInactive();

      expect(mockPrisma.smsMessage.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['clusterId'],
          where: { clusterId: { in: ['c1', 'c2'] } },
        }),
      );
      expect(rows).toEqual([
        expect.objectContaining({
          id: 'c1',
          messageCount: 0,
          linkedMessageCount: 16,
          lastSeenAt: lastSeen,
        }),
        expect.objectContaining({
          id: 'c2',
          linkedMessageCount: 0,
          lastSeenAt: null,
        }),
      ]);
    });

    it('skips the activity query for an empty list', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await service.findArchived();
      expect(mockPrisma.smsMessage.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('archiveEmpty', () => {
    it('archives only retired clusters with no linked messages, and audits once', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
      ]);
      mockPrisma.campaignCluster.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.archiveEmpty('admin-1')).resolves.toEqual({
        archived: 2,
      });

      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
          archivedAt: null,
          messages: { none: {} },
          shieldMessages: { none: {} },
        },
        select: { id: true },
      });
      expect(mockPrisma.campaignCluster.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2'] }, isActive: false, archivedAt: null },
        data: { archivedAt: expect.any(Date), publishedAt: null },
      });
      expect(mockAudit.record).toHaveBeenCalledTimes(1);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          metadata: { action: 'ARCHIVED_EMPTY_BULK', archivedCount: 2 },
        }),
        mockPrisma,
      );
    });

    it('does nothing when there is nothing to archive', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await expect(service.archiveEmpty('admin-1')).resolves.toEqual({
        archived: 0,
      });
      expect(mockPrisma.campaignCluster.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.record).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('throws NotFoundException when cluster does not exist', async () => {
      mockPrisma.campaignCluster.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.campaignCluster.update).not.toHaveBeenCalled();
    });

    it('sets isActive to false and returns id, isActive, updatedAt', async () => {
      const cluster = { id: 'c1', urlDomains: [], isActive: true };
      const updated = { id: 'c1', isActive: false, updatedAt: new Date() };
      mockPrisma.campaignCluster.findUnique.mockResolvedValue(cluster);
      mockPrisma.campaignCluster.update.mockResolvedValue(updated);

      const result = await service.deactivate('c1');

      expect(mockPrisma.campaignCluster.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(result).toEqual(updated);
    });
  });

  describe('getActiveDomains', () => {
    it('returns a Set of all domains across active clusters', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([
        { urlDomains: ['a.com', 'b.com'] },
        { urlDomains: ['b.com', 'c.com'] },
      ]);
      const result = await service.getActiveDomains();
      expect(result).toBeInstanceOf(Set);
      expect(result.has('a.com')).toBe(true);
      expect(result.has('b.com')).toBe(true);
      expect(result.has('c.com')).toBe(true);
    });
  });
});
