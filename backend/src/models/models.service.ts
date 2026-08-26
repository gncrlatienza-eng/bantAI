import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateModelVersionDto } from './dto/create-model-version.dto';

@Injectable()
export class ModelsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.modelVersion.findMany({
      orderBy: { promotedAt: 'desc' },
    });
  }

  findActive() {
    return this.prisma.modelVersion.findFirst({
      where: { isActive: true },
      orderBy: { promotedAt: 'desc' },
    });
  }

  // AI service registers a candidate model version before promotion gating.
  async register(dto: CreateModelVersionDto) {
    const existing = await this.prisma.modelVersion.findUnique({
      where: { versionTag: dto.versionTag },
    });
    if (existing) {
      throw new ConflictException(
        `Model version "${dto.versionTag}" already exists.`,
      );
    }

    return this.prisma.modelVersion.create({
      data: {
        versionTag: dto.versionTag,
        f1Score: dto.f1Score,
        accuracy: dto.accuracy,
        notes: dto.notes,
        isActive: false,
      },
    });
  }

  // Promote a model: deactivate the current active version and activate this one.
  async promote(id: string) {
    const version = await this.prisma.modelVersion.findUnique({
      where: { id },
    });
    if (!version) {
      throw new NotFoundException(`Model version ${id} not found`);
    }

    // Deactivate all currently active versions, then activate the target.
    await this.prisma.$transaction([
      this.prisma.modelVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.modelVersion.update({
        where: { id },
        data: { isActive: true, rolledBackAt: null, promotedAt: new Date() },
      }),
    ]);

    return this.prisma.modelVersion.findUnique({ where: { id } });
  }

  // Rollback: deactivate the current active version and re-activate the target.
  // Used when the promoted model degrades in production.
  async rollback(id: string) {
    const target = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`Model version ${id} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.modelVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false, rolledBackAt: new Date() },
      }),
      this.prisma.modelVersion.update({
        where: { id },
        data: { isActive: true, isRollback: true, promotedAt: new Date() },
      }),
    ]);

    return this.prisma.modelVersion.findUnique({ where: { id } });
  }
}
