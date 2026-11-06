import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AiIndicatorsKeyGuard } from '../auth/guards/api-key.guard';
import { PortalLicensed } from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
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
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'MASKED_DATASET',
  })
  @Get('alerts')
  getAlerts(
    @Request() req: { user: { userId: string } },
    @Query() query: ListAlertsQueryDto,
  ) {
    return this.smsService.getAlerts(req.user.userId, query);
  }

  // Mobile: the alert for one message (Alert detail is keyed by messageId),
  // so the phone no longer downloads the whole list to find it and can open
  // alerts older than the newest page.
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'MASKED_DATASET',
  })
  @Get(':messageId/alert')
  getAlertForMessage(
    @Request() req: { user: { userId: string } },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ) {
    return this.smsService.getAlertForMessage(req.user.userId, messageId);
  }

  // Mobile: fetch SHAP indicator tags for a specific message.
  // Returns { indicators: [] } while SHAP is still computing — not an error.
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'MASKED_DATASET',
  })
  @Get(':messageId/indicators')
  getIndicators(
    @Request() req: { user: { userId: string } },
    @Param('messageId') messageId: string,
  ) {
    return this.smsService.getIndicators(req.user.userId, messageId);
  }

  // Internal: AI/ML service posts SHAP-derived indicator tags for a message.
  @UseGuards(AiIndicatorsKeyGuard)
  @Post(':messageId/indicators')
  storeIndicators(
    @Param('messageId') messageId: string,
    @Body() dto: StoreIndicatorsDto,
  ) {
    return this.smsService.storeIndicators(messageId, dto.indicators);
  }
}
