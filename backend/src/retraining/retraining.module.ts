import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { RetrainingService } from './retraining.service';

@Module({
  imports: [PrismaModule],
  providers: [RetrainingService],
  exports: [RetrainingService],
})
export class RetrainingModule {}
