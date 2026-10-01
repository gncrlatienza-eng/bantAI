import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmsService } from './sms.service';

@Controller('admin/classifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SmsAdminController {
  constructor(private readonly smsService: SmsService) {}

  @Get('mobile-sync')
  getMobileSync() {
    return this.smsService.getAdminMobileSync();
  }

  @Get('history')
  getHistory(
    @Query('label') label?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.smsService.getAdminClassificationHistory({
      label,
      cursor,
      limit: limit === undefined ? undefined : Number(limit),
    });
  }

  @Get()
  getClassifications() {
    return this.smsService.getAdminClassifications();
  }
}
