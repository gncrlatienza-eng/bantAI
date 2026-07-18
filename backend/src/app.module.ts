import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}