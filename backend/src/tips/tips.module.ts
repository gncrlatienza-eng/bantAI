import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { AdminTipsController, PublicTipsController } from './tips.controller';
import { TipsService } from './tips.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminTipsController, PublicTipsController],
  providers: [TipsService],
})
export class TipsModule {}
