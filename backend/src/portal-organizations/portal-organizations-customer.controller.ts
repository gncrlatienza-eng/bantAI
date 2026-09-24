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
import {
  InviteMemberDto,
  TransferOwnershipDto,
} from './dto/customer-workspace.dto';
import { PortalOrganizationsCustomerService } from './portal-organizations-customer.service';

@Controller('portal-organizations/me')
@UseGuards(JwtAuthGuard)
export class PortalOrganizationsCustomerController {
  constructor(
    private readonly workspaceService: PortalOrganizationsCustomerService,
  ) {}

  @Get()
  getMyWorkspace(@Request() req: { user: { userId: string } }) {
    return this.workspaceService.getMyWorkspace(req.user.userId);
  }

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Request() req: { user: { userId: string } },
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaceService.inviteMember(req.user.userId, dto);
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @Request() req: { user: { userId: string } },
    @Param('id') invitationId: string,
  ) {
    return this.workspaceService.revokeInvitation(req.user.userId, invitationId);
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Request() req: { user: { userId: string } },
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaceService.removeMember(req.user.userId, targetUserId);
  }

  @Post('transfer-ownership')
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
  getMyBilling(@Request() req: { user: { userId: string } }) {
    return this.workspaceService.getMyBilling(req.user.userId);
  }
}
