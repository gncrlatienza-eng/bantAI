import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [PrismaModule],
  controllers: [SmsController],
  providers: [SmsService],
})
export class SmsModule {}
