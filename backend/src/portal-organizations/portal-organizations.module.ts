import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { PortalOrganizationsController } from './portal-organizations.controller';
import { PortalOrganizationsService } from './portal-organizations.service';
import { LicenseEntitlementGuard } from './license-entitlement.guard';
import { ClientAudienceGuard } from './client-audience.guard';
import { PortalAccountAdminController } from './portal-account-admin.controller';
import { LegacyLicenseReviewService } from './legacy-license-review.service';
import { PortalOrganizationsCustomerController } from './portal-organizations-customer.controller';
import { PortalOrganizationsCustomerService } from './portal-organizations-customer.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PortalOrganizationsController,
    PortalAccountAdminController,
    PortalOrganizationsCustomerController,
  ],
  providers: [
    PortalOrganizationsService,
    OrganizationScopeGuard,
    LicenseEntitlementGuard,
    ClientAudienceGuard,
    LegacyLicenseReviewService,
    PortalOrganizationsCustomerService,
  ],
  exports: [PortalOrganizationsService, PortalOrganizationsCustomerService],
})
export class PortalOrganizationsModule {}
