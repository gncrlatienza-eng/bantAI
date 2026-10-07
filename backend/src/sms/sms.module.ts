import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AiModule } from '../ai/ai.module';
import { VerificationModule } from '../verification/verification.module';
import { SmsAdminController } from './sms-admin.controller';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { CloudVerificationModule } from '../cloud-verification/cloud-verification.module';

@Module({
  imports: [
    PrismaModule,
    CampaignsModule,
    VerificationModule,
    AiModule,
    CloudVerificationModule,
  ],
  controllers: [SmsController, SmsAdminController],
  providers: [SmsService],
})
export class SmsModule {}
