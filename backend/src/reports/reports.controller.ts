import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PortalLicensed } from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewReportDto } from './dto/review-report.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Mobile: authenticated user submits a FP/FN correction on a message.
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'MASKED_DATASET',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  submit(
    @Request() req: { user: { userId: string } },
    @Body() dto: SubmitReportDto,
  ) {
    return this.reportsService.submit(req.user.userId, dto);
  }

  // Admin: list all reports.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('reports:read')
  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.reportsService.findAll(req.user.userId);
  }

  // Admin: list only Pending reports.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('reports:read')
  @Get('pending')
  findPending(@Request() req: { user: { userId: string } }) {
    return this.reportsService.findPending(req.user.userId);
  }

  // Admin: validate a report — accepts it into the training set.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('reports:manage')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/validate')
  validate(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportsService.validate(id, req.user.userId, dto.adminNote);
  }

  // Admin: reject a report — discards it from the training set.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('reports:manage')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/reject')
  reject(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportsService.reject(id, req.user.userId, dto.adminNote);
  }
}
