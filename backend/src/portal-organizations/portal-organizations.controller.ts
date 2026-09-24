import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreatePortalOrganizationDto } from './dto/create-portal-organization.dto';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { PortalOrganizationsService } from './portal-organizations.service';

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

  @UseGuards(JwtAuthGuard, OrganizationScopeGuard)
  @Get(':organizationId/alerts')
  scopedAlerts(@Param('organizationId') organizationId: string) {
    return this.organizations.scopedAlertSummary(organizationId);
  }
}
