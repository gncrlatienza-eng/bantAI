import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreatePortalOrganizationDto } from './dto/create-portal-organization.dto';

@Injectable()
export class PortalOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePortalOrganizationDto) {
    return this.prisma.portalOrganization.create({
      data: { name: dto.name.trim() },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
  }

  list() {
    return this.prisma.portalOrganization.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
  }

  async addMember(organizationId: string, dto: AddOrganizationMemberDto) {
    const organization = await this.prisma.portalOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    return this.prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId: dto.userId } },
      create: { organizationId, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
      select: { id: true, organizationId: true, userId: true, role: true },
    });
  }

  // Tier-2 staff can see only aggregate, masked metadata for users explicitly
  // enrolled in their organization; no raw sender/body content crosses this API.
  scopedAlertSummary(organizationId: string) {
    return this.prisma.alert.findMany({
      where: {
        message: {
          user: {
            organizationMemberships: { some: { organizationId } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        status: true,
        createdAt: true,
        message: {
          select: {
            id: true,
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
        },
      },
    });
  }
}
