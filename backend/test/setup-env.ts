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
process.env.OTP_HASH_SECRET = 'test-otp-hash-secret';
process.env.SENDER_HASH_SECRET = 'test-sender-hash-secret';
// Unit tests instantiate PrismaClient without connecting to Postgres. This
// test-only URL satisfies Prisma's constructor and never reaches a database.
process.env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/bantai_ci';
