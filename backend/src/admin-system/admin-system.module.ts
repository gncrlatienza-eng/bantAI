import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from '../../database/prisma.module';
import { AdminSystemController } from './admin-system.controller';
import { AdminSystemService } from './admin-system.service';
import { RequestLogInterceptor } from './request-log.interceptor';
import { RequestLogService } from './request-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSystemController],
  providers: [
    AdminSystemService,
    RequestLogService,
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
  ],
})
export class AdminSystemModule {}
