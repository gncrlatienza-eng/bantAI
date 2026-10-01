import { Global, Module } from '@nestjs/common';

import { PortalRoutePolicy } from './portal-route.policy';
import { WorkspaceAccessService } from './workspace-access.service';

/*
 * Global so JwtAuthGuard can resolve PortalRoutePolicy from any feature
 * module, the same way AuthModule is global for the guard itself.
 */
@Global()
@Module({
  providers: [WorkspaceAccessService, PortalRoutePolicy],
  exports: [WorkspaceAccessService, PortalRoutePolicy],
})
export class AccessControlModule {}
