import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
<<<<<<< Updated upstream
=======
import { AiModule } from '../ai/ai.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
>>>>>>> Stashed changes
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
<<<<<<< Updated upstream
  imports: [PrismaModule],
=======
  imports: [PrismaModule, AiModule, CampaignsModule],
>>>>>>> Stashed changes
  controllers: [SmsController],
  providers: [SmsService],
})
export class SmsModule {}
