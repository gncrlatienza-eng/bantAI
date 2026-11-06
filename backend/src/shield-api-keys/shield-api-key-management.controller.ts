import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PortalLicensed } from '../access-control/portal-route.decorator';
import { CreateShieldApiKeyDto } from './dto/create-shield-api-key.dto';
import { ShieldApiKeyService } from './shield-api-key.service';

@Controller('shield/organizations/:organizationId/api-keys')
export class ShieldApiKeyManagementController {
  constructor(private readonly keys: ShieldApiKeyService) {}

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'manageApiKeys',
    entitlement: 'API_ACCESS',
    scope: 'organization-param',
  })
  @Get()
  list(@Param('organizationId') organizationId: string) {
    return this.keys.list(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'manageApiKeys',
    entitlement: 'API_ACCESS',
    scope: 'organization-param',
  })
  @Get('usage')
  usage(@Param('organizationId') organizationId: string) {
    return this.keys.usage(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'manageApiKeys',
    entitlement: 'API_ACCESS',
    scope: 'organization-param',
  })
  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Request() request: { user: { userId: string } },
    @Body() body: CreateShieldApiKeyDto,
  ) {
    return this.keys.create(organizationId, request.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'manageApiKeys',
    entitlement: 'API_ACCESS',
    scope: 'organization-param',
  })
  @Post(':keyId/rotate')
  rotate(
    @Param('organizationId') organizationId: string,
    @Param('keyId') keyId: string,
    @Request() request: { user: { userId: string } },
  ) {
    return this.keys.rotate(organizationId, keyId, request.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'manageApiKeys',
    entitlement: 'API_ACCESS',
    scope: 'organization-param',
  })
  @Delete(':keyId')
  revoke(
    @Param('organizationId') organizationId: string,
    @Param('keyId') keyId: string,
    @Request() request: { user: { userId: string } },
  ) {
    return this.keys.revoke(organizationId, keyId, request.user.userId);
  }
}
