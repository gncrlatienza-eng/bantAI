// Real Nest HTTP guards and PostgreSQL. Use only a disposable bantai_shield_* DB.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');

const url = new URL(process.env.DATABASE_URL ?? '');
if (!url.pathname.startsWith('/bantai_shield_')) {
  throw new Error('Use a disposable bantai_shield_* database.');
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'temporary-local-http-fixture-secret-only';
process.env.OTP_HASH_SECRET = 'temporary-local-http-fixture-secret-only';
process.env.SENDER_HASH_SECRET = 'temporary-local-http-fixture-secret-only';
process.env.EMAIL_OTP_HASH_SECRET = 'temporary-local-http-fixture-secret-only';
process.env.AI_SERVICE_API_KEY = 'temporary-local-http-fixture-secret-only';
process.env.AI_CAMPAIGNS_API_KEY = 'temporary-local-http-fixture-secret-only';
process.env.AI_MODELS_API_KEY = 'temporary-local-http-fixture-secret-only';
process.env.AI_INDICATORS_API_KEY = 'temporary-local-http-fixture-secret-only';
process.env.SEMAPHORE_API_KEY = 'temporary-local-http-fixture-secret-only';
process.env.PORTAL_API_RELEASED = 'false';
const { AppModule } = require('../dist/src/app.module.js');
const prisma = new PrismaClient();

function jwt(userId, audience) {
  const base64url = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({
    sub: userId,
    aud: audience,
    iss: 'bantai-api',
    exp: Math.floor(Date.now() / 1000) + 900,
  });
  const signature = createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function fixture(label, approved, legacyTier = null) {
  const user = await prisma.user.create({
    data: {
      email: `${label}-${Date.now()}@example.test`,
      webRole: 'SHIELD',
      emailVerifiedAt: new Date(),
      onboardingStatus: 'COMPLETE',
    },
  });
  const org = await prisma.portalOrganization.create({
    data: { name: `${label}-${Date.now()}` },
  });
  const accessRequest = await prisma.accessRequest.create({
    data: {
      tier: 'SHIELD',
      legacyTier,
      fullName: label,
      email: user.email,
      organization: org.name,
      intendedUse: 'Fixture test',
      reason: 'HTTP acceptance test',
      status: 'ACTIVE',
      portalUserId: user.id,
      portalOrganizationId: org.id,
      activatedAt: new Date(),
      billingPeriod: 'MONTHLY',
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: user.id, role: 'SHIELD' },
  });
  const license = await prisma.license.create({
    data: {
      accessRequestId: accessRequest.id,
      organizationId: org.id,
      legacyTier,
      status: 'ACTIVE',
      tier: 'SHIELD',
      billingPeriod: 'MONTHLY',
      shieldReviewDecision: approved ? 'APPROVED' : 'PENDING',
      shieldApprovedAt: approved ? new Date() : null,
      validFrom: new Date(Date.now() - 3600_000),
      validUntil: new Date(Date.now() + 3600_000),
    },
  });
  return { user, org, license };
}

let app;
try {
  const admin = await prisma.user.create({
    data: {
      email: `http-admin-${Date.now()}@example.test`,
      role: 'ADMIN',
      webRole: 'ADMIN',
    },
  });
  const approved = await fixture('approved-shield', true);
  const pending = await fixture('legacy-review', false, 'RESEARCH');
  const mobile = await prisma.user.create({
    data: { phone: `+639${String(Date.now()).slice(-9)}` },
  });
  const campaign = await prisma.campaignCluster.create({
    data: {
      label: 'Reviewed lure',
      summary: 'Reviewed phishing pattern',
      risk: 'HIGH',
      category: 'Impersonation',
      mitigation: 'Report suspicious links',
      urlDomains: ['example.test'],
      publishedAt: new Date(),
      isActive: true,
    },
  });
  await prisma.smsMessage.create({
    data: {
      userId: mobile.id,
      clusterId: campaign.id,
      sender: 'hmac-fixture',
      body: '[BRAND] sent [URL]',
    },
  });
  await prisma.shieldCampaignMessage.create({
    data: {
      campaignId: campaign.id,
      maskedText: '[BRAND] sent [URL]',
      approvedAt: new Date(),
      approvedByUserId: admin.id,
    },
  });

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();
  const token = (user, audience) => ({
    Authorization: `Bearer ${jwt(user.id, audience)}`,
  });
  const clientAudience = 'bantai-client-api';
  const adminAudience = 'bantai-admin-api';

  let response = await request(server)
    .get('/api/campaigns')
    .set(token(pending.user, clientAudience));
  assert.equal(response.status, 403, 'legacy review pending must be denied');
  response = await request(server)
    .get('/api/campaigns')
    .set(token(approved.user, clientAudience));
  assert.equal(
    response.status,
    200,
    'approved Shield member must read campaigns',
  );
  assert.equal(
    response.body.some((item) => item.id === campaign.id),
    true,
  );
  assert.equal(JSON.stringify(response.body).includes('centroid'), false);
  assert.equal(JSON.stringify(response.body).includes('hmac-fixture'), false);
  response = await request(server)
    .get(`/api/campaigns/${campaign.id}`)
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body).includes('messages'), false);
  response = await request(server)
    .get(`/api/campaigns/${campaign.id}/export`)
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body).includes('messages'), false);
  response = await request(server)
    .get(`/api/campaigns/${campaign.id}/masked-messages`)
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].text, '[BRAND] sent [URL]');
  for (const path of [
    '/api/messages/raw',
    '/api/dataset',
    '/api/classification-logs',
  ]) {
    response = await request(server)
      .get(path)
      .set(token(approved.user, clientAudience));
    assert.ok(
      [403, 404].includes(response.status),
      `${path} must be unavailable to Shield`,
    );
  }
  response = await request(server)
    .patch(`/api/campaigns/${campaign.id}/deactivate`)
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 403, 'Shield cannot manage campaigns');
  response = await request(server)
    .get('/api/campaigns')
    .set(token(mobile, 'bantai-mobile-api'));
  assert.equal(response.status, 200, 'mobile campaign route remains available');
  response = await request(server)
    .get('/api/admin/portal-accounts/licenses/legacy-review')
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 403);
  response = await request(server)
    .get('/api/admin/portal-accounts/licenses/legacy-review')
    .set(token(admin, adminAudience));
  assert.equal(response.status, 200);
  assert.equal(
    response.body.some(
      (item) =>
        item.id === pending.license.id &&
        item.shieldReviewDecision === 'PENDING',
    ),
    true,
  );
  response = await request(server)
    .get(`/api/campaigns/${campaign.id}`)
    .set(token(admin, adminAudience));
  assert.equal(response.status, 200);
  assert.equal(response.body.messages[0]?.body, '[BRAND] sent [URL]');
  assert.equal(
    await prisma.auditEvent.count({
      where: { actorUserId: admin.id, type: 'RESTRICTED_MESSAGE_ACCESSED' },
    }),
    1,
  );
  response = await request(server)
    .get('/api/admin/portal-accounts')
    .set(token(admin, adminAudience));
  assert.equal(response.status, 200);
  assert.equal(
    response.body.find((item) => item.id === pending.org.id)?.shieldLicensed,
    false,
  );
  assert.equal(
    response.body.find((item) => item.id === approved.org.id)?.shieldLicensed,
    true,
  );
  response = await request(server)
    .post(`/api/admin/portal-accounts/licenses/${pending.license.id}/review`)
    .set(token(admin, adminAudience))
    .send({
      decision: 'REJECTED',
      reason: 'Historical scope excludes current Shield intelligence.',
      evidenceReference: 'CONTRACT-FIXTURE-1',
    });
  assert.equal(response.status, 200);
  assert.equal(
    (await prisma.license.findUnique({ where: { id: pending.license.id } }))
      .shieldApprovedAt,
    null,
  );
  assert.equal(
    await prisma.auditEvent.count({
      where: { licenseId: pending.license.id, type: 'LICENSE_SHIELD_REVIEWED' },
    }),
    1,
  );
  response = await request(server)
    .get('/api/campaigns')
    .set(token(pending.user, clientAudience));
  assert.equal(response.status, 403);
  process.env.PORTAL_API_RELEASED = 'true';
  response = await request(server)
    .post(`/api/shield/organizations/${pending.org.id}/api-keys`)
    .set(token(pending.user, clientAudience))
    .send({ name: 'Denied pending key', scopes: ['READ_CAMPAIGNS'] });
  assert.equal(response.status, 403);
  response = await request(server)
    .post(`/api/shield/organizations/${pending.org.id}/api-keys`)
    .set(token(approved.user, clientAudience))
    .send({ name: 'Cross-tenant key', scopes: ['READ_CAMPAIGNS'] });
  assert.equal(response.status, 403);
  response = await request(server)
    .post(`/api/shield/organizations/${approved.org.id}/api-keys`)
    .set(token(approved.user, clientAudience))
    .send({ name: 'HTTP fixture key', scopes: ['READ_CAMPAIGNS'] });
  assert.equal(response.status, 201);
  const secret = response.body.secret;
  assert.match(secret, /^bnt_live_/);
  assert.equal(JSON.stringify(response.body).includes('secretHash'), false);
  const storedKey = await prisma.shieldApiKey.findUnique({
    where: { id: response.body.id },
  });
  assert.notEqual(storedKey.secretHash, secret);
  response = await request(server)
    .get(`/api/shield/organizations/${approved.org.id}/api-keys`)
    .set(token(approved.user, clientAudience));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body).includes(secret), false);
  assert.equal(JSON.stringify(response.body).includes('secretHash'), false);
  response = await request(server)
    .get('/api/admin/shield-api-keys')
    .set(token(admin, adminAudience));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body).includes(secret), false);
  assert.equal(JSON.stringify(response.body).includes('secretHash'), false);
  response = await request(server)
    .get('/api/shield/v1/campaigns')
    .set({ Authorization: `Bearer ${secret}` });
  assert.equal(response.status, 200);
  response = await request(server)
    .get(`/api/shield/v1/campaigns/${campaign.id}/masked-messages`)
    .set({ Authorization: `Bearer ${secret}` });
  assert.equal(response.status, 403, 'API scope must be enforced');
  await prisma.user.update({
    where: { id: approved.user.id },
    data: { portalAccessStatus: 'SUSPENDED' },
  });
  response = await request(server)
    .get('/api/campaigns')
    .set(token(approved.user, clientAudience));
  assert.ok(
    [401, 403].includes(response.status),
    'suspended Shield account must be denied',
  );
  response = await request(server)
    .get('/api/shield/v1/campaigns')
    .set({ Authorization: `Bearer ${secret}` });
  assert.equal(
    response.status,
    401,
    'key must stop when its creator is suspended',
  );
  await prisma.user.update({
    where: { id: approved.user.id },
    data: { portalAccessStatus: 'ACTIVE' },
  });
  await prisma.license.update({
    where: { id: approved.license.id },
    data: { validUntil: new Date(Date.now() - 1000) },
  });
  response = await request(server)
    .get('/api/campaigns')
    .set(token(approved.user, clientAudience));
  assert.ok(
    [401, 403].includes(response.status),
    'expired Shield license must be denied',
  );
  response = await request(server)
    .get('/api/shield/v1/campaigns')
    .set({ Authorization: `Bearer ${secret}` });
  assert.equal(response.status, 401, 'key must stop when license expires');
  process.env.PORTAL_API_RELEASED = 'false';
  response = await request(server)
    .get('/api/shield/v1/campaigns')
    .set({ Authorization: `Bearer ${secret}` });
  assert.equal(response.status, 403, 'unreleased subscriber API remains off');
  console.log(
    'Real HTTP: Shield-safe data, restricted Admin audit, legacy/cross-tenant/suspended/expired denial, API key one-time secret and scopes, mobile route retained',
  );
} finally {
  if (app) await app.close();
  await prisma.$disconnect();
}
