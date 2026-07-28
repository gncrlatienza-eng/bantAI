import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { StoreIndicatorsDto } from './dto/store-indicators.dto';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('ingest')
  ingest(
    @Request() req: { user: { userId: string } },
    @Body() dto: IngestSmsDto,
  ) {
    return this.smsService.ingest(req.user.userId, dto);
  }

  // Internal: AI/ML service posts SHAP-derived indicator tags for a message.
  // No JWT required — called by the AI service, not a mobile user.
  @Post(':messageId/indicators')
  storeIndicators(
    @Param('messageId') messageId: string,
    @Body() dto: StoreIndicatorsDto,
  ) {
    return this.smsService.storeIndicators(messageId, dto.indicators);
  }
}
