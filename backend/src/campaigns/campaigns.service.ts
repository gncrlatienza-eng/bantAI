import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CampaignsService {
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
  create(data: { label?: string; centroid?: unknown; urlDomains?: string[] }) {
    return this.prisma.campaignCluster.create({
      data: {
        label: data.label,
        centroid: data.centroid ?? undefined,
        urlDomains: data.urlDomains ?? [],
      },
    });
  }

  // Called by the AI/ML service to add newly discovered URL domains to a cluster.
  async addDomains(id: string, domains: string[]) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
    });
    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);

    const merged = Array.from(new Set([...cluster.urlDomains, ...domains]));
    return this.prisma.campaignCluster.update({
      where: { id },
      data: { urlDomains: merged },
    });
  }

  async deactivate(id: string) {
    const cluster = await this.prisma.campaignCluster.findUnique({
      where: { id },
    });
    if (!cluster)
      throw new NotFoundException(`Campaign cluster ${id} not found`);

    return this.prisma.campaignCluster.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
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
  async getActiveDomains(): Promise<Set<string>> {
    const clusters = await this.prisma.campaignCluster.findMany({
      where: { isActive: true },
      select: { urlDomains: true },
    });
    const domains = clusters.flatMap((c) => c.urlDomains);
    return new Set(domains);
  }
}
