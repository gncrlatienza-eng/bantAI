import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { VerificationModule } from '../verification/verification.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, VerificationModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
