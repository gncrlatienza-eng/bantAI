import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

import { PrismaModule } from '../../database/prisma.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
