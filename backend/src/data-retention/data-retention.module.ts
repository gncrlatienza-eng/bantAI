import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [PrismaModule],
  providers: [DataRetentionService],
})
export class DataRetentionModule {}
