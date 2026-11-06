import { Controller, Get, UseGuards } from '@nestjs/common';

import { PortalLicensed } from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { buildShieldDocumentation } from './shield-documentation';

/** Curated server-owned guidance. It deliberately describes only Shield-safe
 * routes and data; administration, training and raw mobile content remain out
 * of this contract. */
@Controller('shield/documentation')
@UseGuards(JwtAuthGuard)
@PortalLicensed({ capability: 'readIntelligence' })
export class ShieldDocumentationController {
  @Get()
  list() {
    return buildShieldDocumentation();
  }
}
