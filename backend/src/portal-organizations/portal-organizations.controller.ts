import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  PortalAccount,
  PortalLicensed,
} from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreatePortalOrganizationDto } from './dto/create-portal-organization.dto';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { PortalOrganizationsService } from './portal-organizations.service';
import { ClientAudienceGuard } from './client-audience.guard';

@Controller('portal-organizations')
export class PortalOrganizationsController {
  constructor(private readonly organizations: PortalOrganizationsService) {}

  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post()
  create(@Body() dto: CreatePortalOrganizationDto) {
    return this.organizations.create(dto);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('overview:read')
  @Get()
  list() {
    return this.organizations.list();
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post(':organizationId/members')
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: AddOrganizationMemberDto,
  ) {
    return this.organizations.addMember(organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @Get('mine')
  mine(@Request() request: { user: { userId: string } }) {
    return this.organizations.listForUser(request.user.userId);
  }

  @UseGuards(JwtAuthGuard, OrganizationScopeGuard)
  @PortalLicensed({
    capability: 'viewWorkspace',
    scope: 'organization-param',
  })
  @Get(':organizationId/entitlements')
  entitlements(@Param('organizationId') organizationId: string) {
    return this.organizations.entitlements(organizationId);
  }
}
