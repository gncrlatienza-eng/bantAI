import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RetrainingService } from './retraining.service';

@Controller('retraining')
@UseGuards(ApiKeyGuard)
export class RetrainingController {
  constructor(private readonly retrainingService: RetrainingService) {}

  // Immediately fires the AI service /retrain call without waiting for the
  // hourly cron. Returns 202 Accepted — the actual training is asynchronous.
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('trigger')
  async trigger() {
    await this.retrainingService.triggerRetrain('manual');
    return { triggered: true, reason: 'manual' };
  }

  // Read-only evaluation of all trigger conditions; does NOT fire retraining.
  @Get('status')
  status() {
    return this.retrainingService.evaluateTriggers();
  }
}
