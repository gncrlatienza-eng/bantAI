import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { AiModule } from '../ai/ai.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [SmsController],
  providers: [SmsService],
})
export class SmsModule {}
