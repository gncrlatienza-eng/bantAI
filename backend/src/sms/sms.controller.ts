import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { StoreIndicatorsDto } from './dto/store-indicators.dto';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('ingest')
  ingest(
    @Request() req: { user: { userId: string } },
    @Body() dto: IngestSmsDto,
  ) {
    return this.smsService.ingest(req.user.userId, dto);
  }

  // Mobile: list all alerts for the authenticated user, newest first.
  @UseGuards(JwtAuthGuard)
  @Get('alerts')
  getAlerts(@Request() req: { user: { userId: string } }) {
    return this.smsService.getAlerts(req.user.userId);
  }

  // Mobile: fetch SHAP indicator tags for a specific message.
  // Returns { indicators: [] } while SHAP is still computing — not an error.
  @UseGuards(JwtAuthGuard)
  @Get(':messageId/indicators')
  getIndicators(
    @Request() req: { user: { userId: string } },
    @Param('messageId') messageId: string,
  ) {
    return this.smsService.getIndicators(req.user.userId, messageId);
  }

  // Internal: AI/ML service posts SHAP-derived indicator tags for a message.
  @UseGuards(ApiKeyGuard)
  @Post(':messageId/indicators')
  storeIndicators(
    @Param('messageId') messageId: string,
    @Body() dto: StoreIndicatorsDto,
  ) {
    return this.smsService.storeIndicators(messageId, dto.indicators);
  }
}
