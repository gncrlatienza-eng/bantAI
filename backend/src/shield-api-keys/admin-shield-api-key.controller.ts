import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShieldApiKeyService } from './shield-api-key.service';
import { UpdateShieldApiLimitsDto } from './dto/update-shield-api-limits.dto';

@Controller('admin/shield-api-keys')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminShieldApiKeyController {
  constructor(private readonly keys: ShieldApiKeyService) {}

  @Get()
  list() {
    return this.keys.listForAdmin();
  }

  @Get('usage')
  usage() {
    return this.keys.usageForAdmin();
  }

  @Get('organizations')
  organizations() {
    return this.keys.listOrganizationsForAdmin();
  }

  @Delete(':keyId')
  revoke(
    @Param('keyId') keyId: string,
    @Request() request: { user: { userId: string } },
  ) {
    return this.keys.revokeForAdmin(keyId, request.user.userId);
  }

  @Patch('organizations/:organizationId/limits')
  updateLimits(
    @Param('organizationId') organizationId: string,
    @Request() request: { user: { userId: string } },
    @Body() dto: UpdateShieldApiLimitsDto,
  ) {
    return this.keys.updateLimits(
      organizationId,
      request.user.userId,
      dto.monthlyQuota,
      dto.rateLimitPerMinute,
    );
  }
}
