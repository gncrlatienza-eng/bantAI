import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { AiModule } from '../ai/ai.module';
import {
  CloudVerificationController,
  ModelWakeController,
} from './cloud-verification.controller';
import { CloudVerificationQueue } from './cloud-verification.queue';
import { CloudVerificationService } from './cloud-verification.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [CloudVerificationController, ModelWakeController],
  providers: [CloudVerificationQueue, CloudVerificationService],
  exports: [CloudVerificationService],
})
export class CloudVerificationModule {}
