import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SmsModule } from './sms/sms.module';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, UsersModule, SmsModule],
})
export class AppModule {}
