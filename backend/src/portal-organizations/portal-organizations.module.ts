import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { PortalOrganizationsController } from './portal-organizations.controller';
import { PortalOrganizationsService } from './portal-organizations.service';

@Module({
  imports: [PrismaModule],
  controllers: [PortalOrganizationsController],
  providers: [PortalOrganizationsService, OrganizationScopeGuard],
})
export class PortalOrganizationsModule {}
