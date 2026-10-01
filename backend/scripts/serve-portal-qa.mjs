// Disposable local browser fixture. Never bind to a public interface.
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
if (!databaseUrl.pathname.startsWith('/bantai_shield_')) {
  throw new Error('Use a disposable bantai_shield_* database.');
}
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const prisma = new PrismaClient();

process.env.NODE_ENV = 'test';
for (const name of [
  'JWT_SECRET',
  'OTP_HASH_SECRET',
  'SENDER_HASH_SECRET',
  'EMAIL_OTP_HASH_SECRET',
  'AI_SERVICE_API_KEY',
  'AI_CAMPAIGNS_API_KEY',
  'AI_MODELS_API_KEY',
  'AI_INDICATORS_API_KEY',
  'SEMAPHORE_API_KEY',
])
  process.env[name] = 'temporary-local-browser-fixture-secret-only';
process.env.PORTAL_API_RELEASED = 'false';
const { AppModule } = require('../dist/src/app.module.js');

function jwt(userId, audience) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: userId,
    aud: audience,
    iss: 'bantai-api',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const signature = createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function setup() {
  const label = `browser-qa-${Date.now()}`;
  const admin = await prisma.user.create({
    data: {
      email: `${label}-admin@example.test`,
      role: 'ADMIN',
      webRole: 'ADMIN',
    },
  });
  const client = await prisma.user.create({
    data: {
      email: `${label}-client@example.test`,
      webRole: 'SHIELD',
      emailVerifiedAt: new Date(),
      onboardingStatus: 'COMPLETE',
    },
  });
  const pending = await prisma.user.create({
    data: {
      email: `${label}-pending@example.test`,
      webRole: 'SHIELD',
      emailVerifiedAt: new Date(),
      onboardingStatus: 'COMPLETE',
    },
  });
  for (const [user, legacyTier] of [
    [client, null],
    [pending, 'RESEARCH'],
  ]) {
    const organization = await prisma.portalOrganization.create({
      data: { name: `${label}-${user.id.slice(0, 8)}` },
    });
    const request = await prisma.accessRequest.create({
      data: {
        tier: 'SHIELD',
        legacyTier,
        fullName: label,
        email: user.email,
        organization: organization.name,
        intendedUse: 'Browser fixture',
        reason: 'Local acceptance',
        status: 'ACTIVE',
        portalUserId: user.id,
        portalOrganizationId: organization.id,
        activatedAt: new Date(),
        billingPeriod: 'MONTHLY',
      },
    });
    await prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'SHIELD',
      },
    });
    await prisma.license.create({
      data: {
        accessRequestId: request.id,
        organizationId: organization.id,
        tier: 'SHIELD',
        legacyTier,
        status: 'ACTIVE',
        billingPeriod: 'MONTHLY',
        shieldReviewDecision: legacyTier ? 'PENDING' : 'APPROVED',
        shieldApprovedAt: legacyTier ? null : new Date(),
        validFrom: new Date(Date.now() - 3600_000),
        validUntil: new Date(Date.now() + 3600_000),
      },
    });
  }
  const campaign = await prisma.campaignCluster.create({
    data: {
      label: 'Reviewed courier lure',
      summary: 'A masked example of a courier impersonation pattern.',
      risk: 'HIGH',
      category: 'Impersonation',
      mitigation: 'Verify delivery notices directly.',
      urlDomains: ['parcel.example'],
      publishedAt: new Date(),
      isActive: true,
    },
  });
  return { admin, client, pending, campaign };
}

const fixture = await setup();
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api');
app.enableCors({
  origin: 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);
const express = app.getHttpAdapter().getInstance();
express.get('/qa/:role', (request, response) => {
  const role = request.params.role;
  const identity = fixture[role];
  if (!identity || role === 'campaign') return response.status(404).end();
  const admin = role === 'admin';
  response.clearCookie(
    admin ? 'bantai_client_session' : 'bantai_admin_session',
    { path: '/' },
  );
  response.cookie(
    admin ? 'bantai_admin_session' : 'bantai_client_session',
    jwt(identity.id, admin ? 'bantai-admin-api' : 'bantai-client-api'),
    { httpOnly: true, sameSite: 'lax', path: '/' },
  );
  return response.redirect(
    `http://localhost:5174/${admin ? 'admin/users' : role === 'pending' ? 'access/status' : 'client/campaigns'}`,
  );
});
await app.listen(3100, '127.0.0.1');
console.log(
  `Local QA server listening on 127.0.0.1:3100; campaign ${fixture.campaign.id}`,
);

const stop = async () => {
  await app.close();
  await prisma.$disconnect();
};
process.on('SIGINT', () => {
  void stop().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void stop().then(() => process.exit(0));
});
