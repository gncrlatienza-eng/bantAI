import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { VerificationController } from './verification.controller';
import { SenderReputationService } from './sender-reputation.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [PrismaModule],
  controllers: [VerificationController],
  providers: [VerificationService, SenderReputationService],
  exports: [VerificationService],
})
export class VerificationModule {}
