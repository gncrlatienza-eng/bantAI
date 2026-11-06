import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { ModelsModule } from '../models/models.module';
import {
  AdminNotificationsController,
  ShieldNotificationsController,
} from './portal-notifications.controller';
import { PortalNotificationsService } from './portal-notifications.service';
import { ShieldDocumentationController } from './shield-documentation.controller';

@Module({
  imports: [PrismaModule, ModelsModule],
  controllers: [
    ShieldNotificationsController,
    ShieldDocumentationController,
    AdminNotificationsController,
  ],
  providers: [PortalNotificationsService],
})
export class PortalNotificationsModule {}
