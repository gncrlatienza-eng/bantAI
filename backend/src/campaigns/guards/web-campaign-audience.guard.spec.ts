import { ForbiddenException } from '@nestjs/common';
import { AuthAudience } from '../../auth/constants';
import { WebCampaignAudienceGuard } from './web-campaign-audience.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CampaignsController } from '../campaigns.controller';

describe('WebCampaignAudienceGuard', () => {
  const guard = new WebCampaignAudienceGuard();
  const context = (audience: AuthAudience, webRole: string | null) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: { audience, webRole } }),
      }),
    }) as never;

  it('denies a mobile session on Shield-only routes', () => {
    expect(() => guard.canActivate(context(AuthAudience.MOBILE, null))).toThrow(
      ForbiddenException,
    );
  });

  it('permits Shield and Admin web sessions', () => {
    expect(guard.canActivate(context(AuthAudience.CLIENT, 'SHIELD'))).toBe(
      true,
    );
    expect(guard.canActivate(context(AuthAudience.ADMIN, 'ADMIN'))).toBe(true);
  });

  it('is registered on Shield-only routes and provided to Nest', () => {
    for (const route of ['findMaskedMessages', 'exportCampaign'] as const) {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        CampaignsController.prototype[route],
      ) as unknown[];
      expect(guards).toContain(WebCampaignAudienceGuard);
    }
    const mobileListGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      CampaignsController.prototype.findAll,
    ) as unknown[];
    expect(mobileListGuards).not.toContain(WebCampaignAudienceGuard);
  });
});
