import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientAudienceGuard } from './client-audience.guard';
import { PortalLicensed } from '../access-control/portal-route.decorator';
import {
  InviteMemberDto,
  TransferOwnershipDto,
} from './dto/customer-workspace.dto';
import { PortalOrganizationsCustomerService } from './portal-organizations-customer.service';

@Controller('portal-organizations/me')
@UseGuards(JwtAuthGuard, ClientAudienceGuard)
@PortalLicensed({ capability: 'viewWorkspace' })
export class PortalOrganizationsCustomerController {
  constructor(
    private readonly workspaceService: PortalOrganizationsCustomerService,
  ) {}

  @Get()
  getMyWorkspace(@Request() req: { user: { userId: string } }) {
    return this.workspaceService.getMyWorkspace(req.user.userId);
  }

  @Post('invitations')
  @PortalLicensed({ capability: 'manageMembers' })
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Request() req: { user: { userId: string } },
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaceService.inviteMember(req.user.userId, dto);
  }

  @Delete('invitations/:id')
  @PortalLicensed({ capability: 'manageMembers' })
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @Request() req: { user: { userId: string } },
    @Param('id') invitationId: string,
  ) {
    return this.workspaceService.revokeInvitation(
      req.user.userId,
      invitationId,
    );
  }

  @Delete('members/:userId')
  @PortalLicensed({ capability: 'manageMembers' })
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Request() req: { user: { userId: string } },
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaceService.removeMember(req.user.userId, targetUserId);
  }

  @Post('transfer-ownership')
  @PortalLicensed({ capability: 'manageWorkspace' })
  @HttpCode(HttpStatus.OK)
  transferOwnership(
    @Request() req: { user: { userId: string } },
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.workspaceService.transferOwnership(req.user.userId, dto);
  }

  @Get('license')
  getMyLicense(@Request() req: { user: { userId: string } }) {
    return this.workspaceService.getMyLicense(req.user.userId);
  }

  @Get('billing')
  @PortalLicensed({ capability: 'viewBilling' })
  getMyBilling(@Request() req: { user: { userId: string } }) {
    return this.workspaceService.getMyBilling(req.user.userId);
  }
}
