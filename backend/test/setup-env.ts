import { jest } from '@jest/globals';

class AllowAllGuard {
  canActivate() {
    return true;
  }
}

// Deterministic non-production secrets for isolated unit tests. Runtime startup
// validates that real deployments provide distinct secret values.
Object.assign(globalThis, { jest });
// Controller unit tests exercise delegation, not the Passport or throttler
// integrations. Nest 12 instantiates decorated guards during compilation, so
// use no-op versions here and keep those integration paths for E2E coverage.
jest.unstable_mockModule('@nestjs/passport', () => ({
  AuthGuard: () => AllowAllGuard,
}));
jest.unstable_mockModule('@nestjs/throttler', () => ({
  SkipThrottle: () => () => undefined,
  Throttle: () => () => undefined,
  ThrottlerGuard: AllowAllGuard,
  ThrottlerModule: { forRoot: () => ({}) },
}));
process.env.FIREBASE_PROJECT_ID = 'bantai-test';
process.env.SENDER_HASH_SECRET = 'test-sender-hash-secret';
// ADMIN_PHONES removed: admin role is now stored on the User record, not
// derived from an env var. Tests that need an admin user create one via the
// Prisma fixture with role: 'ADMIN'.
// Unit tests instantiate PrismaClient without connecting to Postgres. This
// test-only URL satisfies Prisma's constructor and never reaches a database.
process.env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/bantai_ci';
