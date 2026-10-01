import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PortalAccountActionDto } from './dto/portal-account-action.dto';
import { ReviewLegacyLicenseDto } from './dto/review-legacy-license.dto';
import { LegacyLicenseReviewService } from './legacy-license-review.service';
import { PortalOrganizationsService } from './portal-organizations.service';

@Controller('admin/portal-accounts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PortalAccountAdminController {
  constructor(
    private readonly organizations: PortalOrganizationsService,
    private readonly legacyReviews: LegacyLicenseReviewService,
  ) {}

  @Get('licenses/legacy-review')
  listLegacyLicenses() {
    return this.legacyReviews.list();
  }

  @Post('licenses/:licenseId/review')
  @HttpCode(HttpStatus.OK)
  reviewLegacyLicense(
    @Param('licenseId') licenseId: string,
    @Body() dto: ReviewLegacyLicenseDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.legacyReviews.review(licenseId, request.user.userId, dto);
  }

  @Get()
  list() {
    return this.organizations.listAdministrativeAccounts();
  }

  @Post(':userId/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @Param('userId') userId: string,
    @Body() dto: PortalAccountActionDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.organizations.enforcePortalAccount({
      targetUserId: userId,
      actorUserId: request.user.userId,
      action: 'SUSPEND',
      reason: dto.reason,
    });
  }

  @Post(':userId/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('userId') userId: string,
    @Body() dto: PortalAccountActionDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.organizations.enforcePortalAccount({
      targetUserId: userId,
      actorUserId: request.user.userId,
      action: 'RESTORE',
      reason: dto.reason,
    });
  }

  @Post(':userId/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('userId') userId: string,
    @Body() dto: PortalAccountActionDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.organizations.enforcePortalAccount({
      targetUserId: userId,
      actorUserId: request.user.userId,
      action: 'REVOKE',
      reason: dto.reason,
    });
  }
}
