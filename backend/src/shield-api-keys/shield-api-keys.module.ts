import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ShieldApiKeyGuard } from './shield-api-key.guard';
import { ShieldApiKeyManagementController } from './shield-api-key-management.controller';
import { ShieldCampaignApiController } from './shield-campaign-api.controller';
import { ShieldApiKeyService } from './shield-api-key.service';
import { AdminShieldApiKeyController } from './admin-shield-api-key.controller';
import { ShieldApiUsageInterceptor } from './shield-api-usage.interceptor';

@Module({
  imports: [CampaignsModule],
  controllers: [
    ShieldApiKeyManagementController,
    ShieldCampaignApiController,
    AdminShieldApiKeyController,
  ],
  providers: [
    ShieldApiKeyGuard,
    ShieldApiKeyService,
    ShieldApiUsageInterceptor,
  ],
})
export class ShieldApiKeysModule {}
