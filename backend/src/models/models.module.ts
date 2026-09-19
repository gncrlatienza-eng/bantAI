import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { ModelsController } from './models.controller';
import { InternalModelsController } from './internal-models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModelsController, InternalModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
