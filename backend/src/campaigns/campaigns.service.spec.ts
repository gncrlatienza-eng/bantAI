import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  campaignCluster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('queries only active clusters ordered by messageCount desc', () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      service.findAll();
      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { messageCount: 'desc' },
        }),
      );
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

    it('queries active clusters with hasSome filter', () => {
      mockPrisma.campaignCluster.findFirst.mockResolvedValue(null);
      service.findByDomains(['evil.com']);
      expect(mockPrisma.campaignCluster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, urlDomains: { hasSome: ['evil.com'] } },
        }),
      );
    });
  });

  describe('findAllInactive', () => {
    it('queries only inactive clusters ordered by updatedAt desc', () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      service.findAllInactive();
      expect(mockPrisma.campaignCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('returns an empty array when no inactive clusters exist', async () => {
      mockPrisma.campaignCluster.findMany.mockResolvedValue([]);
      await expect(service.findAllInactive()).resolves.toEqual([]);
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
