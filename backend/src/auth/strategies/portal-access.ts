import { UnauthorizedException } from '@nestjs/common';

import { AuthAudience } from '../constants';

export function assertPortalAccessAllowed(
  audience: AuthAudience,
  portalAccessStatus: string,
  webRole?: string | null,
): void {
  if (audience === AuthAudience.CLIENT) {
    if (webRole !== 'SHIELD') {
      throw new UnauthorizedException('Shield access is required.');
    }
    if (portalAccessStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Portal access is no longer active.');
    }
  }
  if (audience === AuthAudience.ADMIN && webRole !== 'ADMIN') {
    throw new UnauthorizedException('Administrator access is required.');
  }
}
