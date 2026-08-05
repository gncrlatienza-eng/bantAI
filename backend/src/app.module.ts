import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 120 }, // 120 req/min per IP by default
    ]),
    PrismaModule,
    HealthModule,
    AiModule,
    AuthModule,
    UsersModule,
    SmsModule,
    CampaignsModule,
    VerificationModule,
  ],
  providers: [
    // Apply throttle globally; individual routes can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
