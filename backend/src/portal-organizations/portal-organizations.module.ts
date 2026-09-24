import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { PortalOrganizationsController } from './portal-organizations.controller';
import { PortalOrganizationsService } from './portal-organizations.service';
import { PortalOrganizationsCustomerController } from './portal-organizations-customer.controller';
import { PortalOrganizationsCustomerService } from './portal-organizations-customer.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PortalOrganizationsController,
    PortalOrganizationsCustomerController,
  ],
  providers: [
    PortalOrganizationsService,
    PortalOrganizationsCustomerService,
    OrganizationScopeGuard,
  ],
  exports: [PortalOrganizationsService, PortalOrganizationsCustomerService],
})
export class PortalOrganizationsModule {}

