import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminSystemService } from './admin-system.service';
import { ApiLogQueryDto } from './dto/api-log-query.dto';
import { AuditEventQueryDto } from './dto/audit-event-query.dto';
import { RequestLogService } from './request-log.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@RequirePermissions('system:read')
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

  // Audit trail is SUPERADMIN-only in the Admin nav ('*').
  @RequirePermissions('*')
  @Get('audit-events')
  getAuditEvents(@Query() query: AuditEventQueryDto) {
    return this.system.getAuditEvents({
      includeReads: query.includeReads === 'true',
      type: query.type,
    });
  }
}
