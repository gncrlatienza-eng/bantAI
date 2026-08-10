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

import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewReportDto } from './dto/review-report.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Mobile: authenticated user submits a FP/FN correction on a message.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  submit(
    @Request() req: { user: { userId: string } },
    @Body() dto: SubmitReportDto,
  ) {
    return this.reportsService.submit(req.user.userId, dto);
  }

  // Admin: list all reports.
  @UseGuards(ApiKeyGuard)
  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  // Admin: list only Pending reports.
  @UseGuards(ApiKeyGuard)
  @Get('pending')
  findPending() {
    return this.reportsService.findPending();
  }

  // Admin: validate a report — accepts it into the training set.
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/validate')
  validate(@Param('id') id: string, @Body() dto: ReviewReportDto) {
    return this.reportsService.validate(id, dto.adminNote);
  }

  // Admin: reject a report — discards it from the training set.
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewReportDto) {
    return this.reportsService.reject(id, dto.adminNote);
  }
}
