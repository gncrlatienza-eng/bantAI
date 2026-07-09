import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../database/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
  PrismaModule,
  HealthModule,
  UsersModule,
  ],
})
export class AppModule {}