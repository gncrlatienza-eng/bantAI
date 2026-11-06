import { UnauthorizedException } from '@nestjs/common';

import { AuthAudience } from '../constants';
import { assertPortalAccessAllowed } from './portal-access';

describe('client portal access status enforcement', () => {
  it.each(['SUSPENDED', 'REVOKED'])(
    'rejects an existing %s client session immediately',
    (portalAccessStatus) => {
      expect(() =>
        assertPortalAccessAllowed(
          AuthAudience.CLIENT,
          portalAccessStatus,
          'SHIELD',
        ),
      ).toThrow(UnauthorizedException);
    },
  );

  it('allows an active client session', () => {
    expect(() =>
      assertPortalAccessAllowed(AuthAudience.CLIENT, 'ACTIVE', 'SHIELD'),
    ).not.toThrow();
  });

  it('does not apply client status enforcement to mobile sessions', () => {
    expect(() =>
      assertPortalAccessAllowed(AuthAudience.MOBILE, 'REVOKED'),
    ).not.toThrow();
  });

  it('does not apply client status enforcement to admin sessions', () => {
    expect(() =>
      assertPortalAccessAllowed(AuthAudience.ADMIN, 'REVOKED', 'ADMIN'),
    ).not.toThrow();
  });
});
