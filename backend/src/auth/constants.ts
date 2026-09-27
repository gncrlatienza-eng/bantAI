export enum AuthAudience {
  MOBILE = 'bantai-mobile-api',
  CLIENT = 'bantai-client-api',
  ADMIN = 'bantai-admin-api',
}

export const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || 'bantai-api';

function configuredSecret(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Each web security domain gets an independent signing secret in production.
 * Local/test environments may fall back to JWT_SECRET so existing developer
 * setups keep working while the new secrets are rolled out.
 */
export function jwtSecretFor(audience: AuthAudience): string {
  if (audience === AuthAudience.MOBILE) {
    const mobileLegacySecret = configuredSecret('JWT_SECRET');
    if (mobileLegacySecret) return mobileLegacySecret;
    throw new Error('JWT_SECRET must be configured for mobile authentication.');
  }

  const envName =
    audience === AuthAudience.ADMIN ? 'ADMIN_JWT_SECRET' : 'CLIENT_JWT_SECRET';
  const domainSecret = configuredSecret(envName);
  if (domainSecret) return domainSecret;

  const legacy = configuredSecret('JWT_SECRET');
  if (legacy && process.env.NODE_ENV !== 'production') return legacy;
  throw new Error(`${envName} must be configured with a distinct secret.`);
}

// JwtModule still needs a default secret for dependency initialization. Every
// token issuance below supplies the correct audience-specific secret.
export const jwtConstants = {
  secret: jwtSecretFor(AuthAudience.MOBILE),
};

export const CLIENT_SESSION_COOKIE = 'bantai_client_session';
export const ADMIN_SESSION_COOKIE = 'bantai_admin_session';

// Transitional name retained only so old callers can clear the stale cookie.
export const LEGACY_PORTAL_SESSION_COOKIE = 'bantai_portal_session';
