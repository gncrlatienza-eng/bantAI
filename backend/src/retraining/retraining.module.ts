import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { RetrainingController } from './retraining.controller';
import { RetrainingService } from './retraining.service';

@Module({
  imports: [PrismaModule],
  controllers: [RetrainingController],
  providers: [RetrainingService],
  exports: [RetrainingService],
})
export class RetrainingModule {}
