import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminSystemService } from './admin-system.service';
import { ApiLogQueryDto } from './dto/api-log-query.dto';
import { AuditEventQueryDto } from './dto/audit-event-query.dto';
import { RequestLogService } from './request-log.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSystemController {
  constructor(
    private readonly system: AdminSystemService,
    private readonly logs: RequestLogService,
  ) {}

  @Get('api-logs')
  getApiLogs(@Query() query: ApiLogQueryDto) {
    return this.logs.list(query.limit);
  }

  @Get('db-storage')
  getDatabaseStorage() {
    return this.system.getDatabaseStorage();
  }

  @Get('audit-events')
  getAuditEvents(@Query() query: AuditEventQueryDto) {
    return this.system.getAuditEvents({
      includeReads: query.includeReads === 'true',
      type: query.type,
    });
  }
}
