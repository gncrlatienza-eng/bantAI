import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../database/prisma.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SmsModule } from './sms/sms.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { VerificationModule } from './verification/verification.module';
import { ReportsModule } from './reports/reports.module';
import { ModelsModule } from './models/models.module';
import { RetrainingModule } from './retraining/retraining.module';
import { BlockedNumbersModule } from './blocked-numbers/blocked-numbers.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { PortalOrganizationsModule } from './portal-organizations/portal-organizations.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { PaymentsModule } from './payments/payments.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 120 }, // 120 req/min per IP by default
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AnalyticsModule,
    HealthModule,
    AiModule,
    UsersModule,
    SmsModule,
    CampaignsModule,
    VerificationModule,
    ReportsModule,
    ModelsModule,
    RetrainingModule,
    BlockedNumbersModule,
    DataRetentionModule,
    PortalOrganizationsModule,
    AccessRequestsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    // Apply throttle globally; individual routes can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
