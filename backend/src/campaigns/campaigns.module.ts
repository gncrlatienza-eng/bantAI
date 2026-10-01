import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

import { PrismaModule } from '../../database/prisma.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignReconciliationService } from './campaign-reconciliation.service';
import { CampaignAnalysisService } from './campaign-analysis.service';
import { WebCampaignAudienceGuard } from './guards/web-campaign-audience.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignReconciliationService,
    CampaignAnalysisService,
    WebCampaignAudienceGuard,
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
