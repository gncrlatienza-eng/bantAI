import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ShieldApiScope } from '@prisma/client';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ShieldApiKeyGuard } from './shield-api-key.guard';
import { ShieldScope } from './shield-scope.decorator';
import { ShieldApiUsageInterceptor } from './shield-api-usage.interceptor';

@Controller('shield/v1/campaigns')
@UseGuards(ShieldApiKeyGuard)
@UseInterceptors(ShieldApiUsageInterceptor)
export class ShieldCampaignApiController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ShieldScope(ShieldApiScope.READ_CAMPAIGNS)
  list() {
    return this.campaigns.findShieldAll();
  }

  @Get('active')
  @ShieldScope(ShieldApiScope.READ_CAMPAIGNS)
  async active() {
    return (await this.campaigns.findShieldAll()).filter(
      (campaign) => campaign.status === 'ACTIVE',
    );
  }

  @Get('updates')
  @ShieldScope(ShieldApiScope.READ_CAMPAIGNS)
  updates() {
    return this.campaigns.findShieldAll();
  }

  @Get(':id/masked-messages')
  @ShieldScope(ShieldApiScope.READ_MASKED_MESSAGES)
  maskedMessages(@Param('id') id: string) {
    return this.campaigns.findShieldMaskedMessages(id);
  }

  @Get(':id/indicators')
  @ShieldScope(ShieldApiScope.READ_INDICATORS)
  indicators(@Param('id') id: string) {
    return this.campaigns.findShieldIndicators(id);
  }

  @Get(':id/timeline')
  @ShieldScope(ShieldApiScope.READ_CAMPAIGNS)
  timeline(@Param('id') id: string) {
    return this.campaigns.findShieldTimeline(id);
  }

  @Get(':id/export')
  @ShieldScope(ShieldApiScope.EXPORT_CAMPAIGNS)
  exportCampaign(@Param('id') id: string) {
    return this.campaigns.findShieldOne(id);
  }

  @Get(':id')
  @ShieldScope(ShieldApiScope.READ_CAMPAIGNS)
  detail(@Param('id') id: string) {
    return this.campaigns.findShieldOne(id);
  }
}
