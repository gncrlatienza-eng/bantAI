import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [PrismaModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
