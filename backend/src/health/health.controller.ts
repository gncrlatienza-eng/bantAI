import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: answers without a database query so an orchestrator can tell a
  // wedged process from a temporary dependency outage.
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'bantAI Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  // Readiness: deployment traffic should only be sent to an instance after it
  // can reach PostgreSQL. Keep this separate from liveness to avoid restart
  // loops during short database maintenance windows.
  @Get('ready')
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'reachable' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable.');
    }
  }
}
