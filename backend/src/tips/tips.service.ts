import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateSafetyTipDto } from './dto/create-safety-tip.dto';
import { UpdateSafetyTipDto } from './dto/update-safety-tip.dto';

const TIP_SELECT = {
  id: true,
  title: true,
  body: true,
  region: true,
  campaign: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TipsService {
  constructor(private readonly prisma: PrismaService) {}

  listAdmin() {
    return this.prisma.safetyTip.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: TIP_SELECT,
    });
  }

  listPublished() {
    return this.prisma.safetyTip.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        region: true,
        campaign: true,
        updatedAt: true,
      },
    });
  }

  create(dto: CreateSafetyTipDto) {
    return this.prisma.safetyTip.create({
      data: this.normalize(dto),
      select: TIP_SELECT,
    });
  }

  async update(id: string, dto: UpdateSafetyTipDto) {
    await this.requireTip(id);
    return this.prisma.safetyTip.update({
      where: { id },
      data: this.normalize(dto),
      select: TIP_SELECT,
    });
  }

  async remove(id: string) {
    await this.requireTip(id);
    await this.prisma.safetyTip.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireTip(id: string) {
    const tip = await this.prisma.safetyTip.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tip) throw new NotFoundException('Safety tip not found.');
  }

  private normalize<T extends CreateSafetyTipDto | UpdateSafetyTipDto>(dto: T) {
    return {
      ...dto,
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
      ...(dto.region !== undefined
        ? { region: dto.region?.trim() || null }
        : {}),
      ...(dto.campaign !== undefined
        ? { campaign: dto.campaign?.trim() || null }
        : {}),
    };
  }
}
