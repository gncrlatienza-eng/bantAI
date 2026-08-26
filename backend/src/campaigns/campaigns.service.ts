import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

const DOMAIN_CACHE_TTL_MS = 60_000;

@Injectable()
export class CampaignsService {
  private _domainCache: Set<string> | null = null;
  private _domainCacheExpiry = 0;

  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaignCluster.findMany({
      where: { isActive: true },
      orderBy: { messageCount: 'desc' },
      select: {
        id: true,
        label: true,
        urlDomains: true,
        isActive: true,
        messageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
      include: {
        messages: {
          select: {
            id: true,
            sender: true,
            body: true,
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
          orderBy: { receivedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);
    return cluster;
  }

  // Called by the AI/ML service to register a new campaign cluster.
  async create(data: {
    label?: string;
    centroid?: unknown;
    urlDomains?: string[];
  }) {
    const cluster = await this.prisma.campaignCluster.create({
      data: {
        label: data.label,
        centroid: data.centroid ?? undefined,
        urlDomains: data.urlDomains ?? [],
      },
    });
    this.invalidateDomainCache();
    return cluster;
  }

  // Called by the AI/ML service to add newly discovered URL domains to a cluster.
  async addDomains(id: string, domains: string[]) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
    });
    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);

    const merged = Array.from(new Set([...cluster.urlDomains, ...domains]));
    const updated = await this.prisma.campaignCluster.update({
      where: { id },
      data: { urlDomains: merged },
    });
    this.invalidateDomainCache();
    return updated;
  }

  async deactivate(id: string) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
    });
    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);

    const updated = await this.prisma.campaignCluster.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
    this.invalidateDomainCache();
    return updated;
  }

  // Used internally by SmsService during link suppression.
  // Finds an active cluster whose urlDomains overlap with the provided domains.
  findByDomains(domains: string[]) {
    if (domains.length === 0) return null;
    return this.prisma.campaignCluster.findFirst({
      where: {
        isActive: true,
        urlDomains: { hasSome: domains },
      },
    });
  }

  findAllInactive() {
    return this.prisma.campaignCluster.findMany({
      where: { isActive: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        label: true,
        urlDomains: true,
        isActive: true,
        messageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Internal: AI service fetches centroids to check cosine similarity against new messages.
  findAllCentroids() {
    return this.prisma.campaignCluster.findMany({
      where: { isActive: true },
      select: { id: true, centroid: true },
    });
  }

  incrementMessageCount(id: string) {
    return this.prisma.campaignCluster.update({
      where: { id },
      data: { messageCount: { increment: 1 } },
    });
  }

  // Returns a flat Set of all URL domains across active clusters.
  // Used by SmsService for O(1) domain lookups during link suppression.
  // Cached for 60 s to avoid a full table scan on every SMS ingest.
  async getActiveDomains(): Promise<Set<string>> {
    if (this._domainCache && Date.now() < this._domainCacheExpiry) {
      return this._domainCache;
    }
    const clusters = await this.prisma.campaignCluster.findMany({
      where: { isActive: true },
      select: { urlDomains: true },
    });
    const domains = clusters.flatMap((c) => c.urlDomains);
    this._domainCache = new Set(domains);
    this._domainCacheExpiry = Date.now() + DOMAIN_CACHE_TTL_MS;
    return this._domainCache;
  }

  // Call after creating or deactivating a cluster so the next ingest sees fresh domains.
  invalidateDomainCache(): void {
    this._domainCache = null;
    this._domainCacheExpiry = 0;
  }
}
