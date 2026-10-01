import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import {
  DatasetsController,
  InternalDatasetsController,
} from './datasets.controller';
import { DatasetsService } from './datasets.service';

@Module({
  imports: [PrismaModule],
  controllers: [DatasetsController, InternalDatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
