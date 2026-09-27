import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetrainingService } from './retraining.service';

@Controller('retraining')
@UseGuards(JwtAuthGuard, StaffGuard)
export class RetrainingController {
  constructor(private readonly retrainingService: RetrainingService) {}

  // Immediately fires the AI service /retrain call without waiting for the
  // hourly cron. Returns 202 Accepted — the actual training is asynchronous.
  @RequirePermissions('retraining:trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('trigger')
  async trigger() {
    await this.retrainingService.triggerRetrain('manual');
    return { triggered: true, reason: 'manual' };
  }

  // Read-only evaluation of all trigger conditions; does NOT fire retraining.
  @RequirePermissions('retraining:trigger')
  @Get('status')
  status() {
    return this.retrainingService.evaluateTriggers();
  }
}
