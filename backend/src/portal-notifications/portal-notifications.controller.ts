import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationAudience } from '@prisma/client';

import { PortalLicensed } from '../access-control/portal-route.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { PortalNotificationsService } from './portal-notifications.service';

type AuthRequest = { user: { userId: string } };

@Controller('shield/notifications')
@UseGuards(JwtAuthGuard)
@PortalLicensed({ capability: 'readIntelligence' })
export class ShieldNotificationsController {
  constructor(private readonly notifications: PortalNotificationsService) {}

  @Get('preferences')
  preferences(@Request() req: AuthRequest) {
    return this.notifications.preferences(req.user.userId);
  }

  @Patch('preferences')
  update(
    @Request() req: AuthRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(req.user.userId, dto);
  }

  @Get()
  inbox(@Request() req: AuthRequest) {
    return this.notifications.inbox(
      req.user.userId,
      NotificationAudience.SHIELD,
    );
  }

  @Patch(':id/read')
  read(@Request() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(
      req.user.userId,
      NotificationAudience.SHIELD,
      id,
    );
  }

  @Post('read-all')
  readAll(@Request() req: AuthRequest) {
    return this.notifications.markAllRead(
      req.user.userId,
      NotificationAudience.SHIELD,
    );
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: PortalNotificationsService) {}

  @Get('preferences')
  preferences(@Request() req: AuthRequest) {
    return this.notifications.preferences(req.user.userId);
  }

  @Patch('preferences')
  update(
    @Request() req: AuthRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(req.user.userId, dto);
  }

  @Get()
  inbox(@Request() req: AuthRequest) {
    return this.notifications.inbox(
      req.user.userId,
      NotificationAudience.ADMIN,
    );
  }

  @Patch(':id/read')
  read(@Request() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(
      req.user.userId,
      NotificationAudience.ADMIN,
      id,
    );
  }

  @Post('read-all')
  readAll(@Request() req: AuthRequest) {
    return this.notifications.markAllRead(
      req.user.userId,
      NotificationAudience.ADMIN,
    );
  }
}
