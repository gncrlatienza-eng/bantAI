import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AiModule } from '../ai/ai.module';
import { VerificationModule } from '../verification/verification.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [PrismaModule, CampaignsModule, VerificationModule, AiModule],
  controllers: [SmsController],
  providers: [SmsService],
})
export class SmsModule {}
