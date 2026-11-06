import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OpenDriftInvestigationDto } from './dto/open-drift-investigation.dto';
import { UpdateDriftInvestigationDto } from './dto/update-drift-investigation.dto';
import { RetrainingService } from './retraining.service';

type AuthRequest = { user: { userId: string } };

@Controller('retraining')
@UseGuards(JwtAuthGuard, StaffGuard)
export class RetrainingController {
  constructor(private readonly retrainingService: RetrainingService) {}

  // Queues a retraining request with the AI service without waiting for the
  // hourly cron. Returns 202 Accepted — training itself runs offline.
  @RequirePermissions('retraining:trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('trigger')
  async trigger(@Request() req: AuthRequest) {
    const job = await this.retrainingService.triggerRetrain(
      'manual',
      req.user.userId,
    );
    return { triggered: true, reason: 'manual', job };
  }

  // Read-only evaluation of all trigger conditions; does NOT fire retraining.
  @RequirePermissions('retraining:trigger')
  @Get('status')
  status() {
    return this.retrainingService.status();
  }

  @RequirePermissions('retraining:trigger')
  @Get('jobs')
  jobs() {
    return this.retrainingService.listJobs();
  }

  @RequirePermissions('retraining:trigger')
  @Get('investigations')
  investigations() {
    return this.retrainingService.listInvestigations();
  }

  @RequirePermissions('retraining:trigger')
  @Post('investigations')
  open(@Body() dto: OpenDriftInvestigationDto, @Request() req: AuthRequest) {
    return this.retrainingService.openInvestigation(req.user.userId, dto.notes);
  }

  @RequirePermissions('retraining:trigger')
  @Patch('investigations/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriftInvestigationDto,
    @Request() req: AuthRequest,
  ) {
    return this.retrainingService.updateInvestigation(id, dto, req.user.userId);
  }

  @RequirePermissions('retraining:trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('investigations/:id/retrain')
  retrain(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuthRequest) {
    return this.retrainingService.retrainForInvestigation(id, req.user.userId);
  }
}
