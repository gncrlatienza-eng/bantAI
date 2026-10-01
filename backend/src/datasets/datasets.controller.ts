import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AiDatasetsKeyGuard } from '../auth/guards/api-key.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDatasetSnapshotDto } from './dto/create-dataset-snapshot.dto';
import { CurateReportDto } from './dto/curate-report.dto';
import { UpdateDatasetSampleDto } from './dto/update-dataset-sample.dto';
import { DatasetsService } from './datasets.service';

type AuthRequest = { user: { userId: string } };

@Controller('datasets')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Get()
  overview() {
    return this.datasets.overview();
  }

  @Post('reports/:reportId')
  curateReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: CurateReportDto,
    @Request() req: AuthRequest,
  ) {
    return this.datasets.curateValidatedReport(reportId, dto, req.user.userId);
  }

  @Patch('samples/:id')
  updateSample(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDatasetSampleDto,
    @Request() req: AuthRequest,
  ) {
    return this.datasets.updateSample(id, dto, req.user.userId);
  }

  @Get('samples/:id/revisions')
  revisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.datasets.revisions(id);
  }

  @Get('snapshots/:versionTag/export.jsonl')
  async exportSnapshot(
    @Param('versionTag') versionTag: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.datasets.exportSnapshotJsonl(
      versionTag,
      req.user.userId,
    );
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${versionTag.replace(/[^a-zA-Z0-9._-]/g, '_')}.jsonl"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return body;
  }

  @Post('snapshots')
  createSnapshot(
    @Body() dto: CreateDatasetSnapshotDto,
    @Request() req: AuthRequest,
  ) {
    return this.datasets.createSnapshot(dto, req.user.userId);
  }
}

/** Training pipeline reads a frozen snapshot by its version tag. */
@Controller('internal/datasets')
@UseGuards(AiDatasetsKeyGuard)
export class InternalDatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Get('snapshots/:versionTag')
  exportSnapshot(@Param('versionTag') versionTag: string) {
    return this.datasets.exportSnapshot(versionTag);
  }
}
