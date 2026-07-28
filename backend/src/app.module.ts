import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../database/prisma.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SmsModule } from './sms/sms.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AiModule,
    AuthModule,
    UsersModule,
    SmsModule,
    CampaignsModule,
    VerificationModule,
  ],
})
export class AppModule {}
