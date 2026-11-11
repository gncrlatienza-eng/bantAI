import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, StaffGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RequirePermissions('overview:read')
  @Get('summary')
  async getSummary(@Query('range') range?: string) {
    return this.analyticsService.getSummary({ range });
  }

  @RequirePermissions('overview:read')
  @Get('admin/trends')
  async getAdminTrends(
    @Query('range') range?: string,
    @Query('interval') interval?: string,
  ) {
    return this.analyticsService.getAdminThreatTrends({ range, interval });
  }
}
