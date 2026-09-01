import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { BlockedNumbersController } from './blocked-numbers.controller';
import { BlockedNumbersService } from './blocked-numbers.service';

@Module({
  imports: [PrismaModule],
  controllers: [BlockedNumbersController],
  providers: [BlockedNumbersService],
})
export class BlockedNumbersModule {}
