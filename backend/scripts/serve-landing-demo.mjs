// Disposable landing-capture server. Seeds synthetic demo data from
// web/src/pages/Landing/landingDemo.json and serves the API on 127.0.0.1:3101.
// Never bind to a public interface. Never point at a real database.
// Web for captures runs on http://127.0.0.1:5175 (same site as the API, so the
// lax session cookie is sent).
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { assertDisposableDb } from './landing-demo-guard.mjs';

assertDisposableDb(process.env.DATABASE_URL ?? '');
const demo = JSON.parse(
  readFileSync(new URL('../../web/src/pages/Landing/landingDemo.json', import.meta.url), 'utf8'),
);
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const prisma = new PrismaClient();

const WEB = 'http://127.0.0.1:5175';
process.env.NODE_ENV = 'test';
for (const name of [
  'JWT_SECRET', 'OTP_HASH_SECRET', 'SENDER_HASH_SECRET', 'EMAIL_OTP_HASH_SECRET',
  'AI_SERVICE_API_KEY', 'AI_CAMPAIGNS_API_KEY', 'AI_MODELS_API_KEY', 'AI_INDICATORS_API_KEY',
  'SEMAPHORE_API_KEY',
]) process.env[name] = 'temporary-landing-demo-secret-only';
process.env.PORTAL_API_RELEASED = 'false';
// Placeholder test-mode key: the payments module refuses to boot without one,
// and nothing in the capture flow calls Stripe.
process.env.STRIPE_SECRET_KEY = 'sk_test_landing_demo_placeholder';
process.env.STRIPE_CHECKOUT_MODE = 'test';
process.env.AI_SERVICE_URL ??= 'http://127.0.0.1:8001';

// Echo OTPs locally instead of sending an SMS.
const { OtpSmsService } = require('../dist/src/auth/otp-sms.service.js');
OtpSmsService.prototype.send = async (phone, otp) => console.log(`[demo-otp] ${phone} ${otp}`);
const { AppModule } = require('../dist/src/app.module.js');

function jwt(userId, audience) {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc({ sub: userId, aud: audience, iss: 'bantai-api', exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac('sha256', process.env.JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const DAY = 86_400_000;
const firstSeen = new Date(Date.UTC(2026, 8, 4, 1, 38)); // Sep 4

// Idempotent: the server can restart against the same disposable DB.
async function seed() {
  const admin = await prisma.user.upsert({
    where: { email: demo.demoAnalystEmail },
    update: { staffRole: 'ANALYST' },
    create: {
      email: demo.demoAnalystEmail, firstName: 'Demo', lastName: 'Analyst',
      role: 'ADMIN', webRole: 'ADMIN', staffRole: 'ANALYST',
      emailVerifiedAt: new Date(), onboardingStatus: 'COMPLETE',
    },
  });
  const mobile = await prisma.user.upsert({
    where: { phone: demo.demoMobilePhone },
    update: {},
    create: { phone: demo.demoMobilePhone, firstName: 'Demo', lastName: 'User' },
  });
  const c = demo.campaign;
  const campaign =
    (await prisma.campaignCluster.findFirst({ where: { label: c.label } })) ??
    (await prisma.campaignCluster.create({ data: {
      label: c.label, summary: c.summary, risk: c.risk.toUpperCase(), category: c.category,
      mitigation: 'Open GCash only through the official app; GCash never sends verification links by SMS.',
      urlDomains: [...new Set(demo.variants.map((v) => v.domain))],
      messageCount: c.messageCount, publishedAt: new Date(), isActive: true,
    } }));
  // Campaign dates match the landing copy (first seen Sep 4, last seen Sep 20).
  const lastSeen = new Date(firstSeen.getTime() + (demo.variants.at(-1).day - 1) * DAY);
  await prisma.campaignCluster.update({
    where: { id: campaign.id },
    data: { createdAt: firstSeen, updatedAt: lastSeen },
  });
  // c.messageCount messages spread over the wording variants (a real campaign
  // repeats each wording many times), each on its variant's first-seen day.
  const share = [40, 30, 25, 22, 18, 13];
  if (share.reduce((a, b) => a + b, 0) !== c.messageCount || share.length !== demo.variants.length) {
    throw new Error('landing demo: per-variant message shares must sum to campaign.messageCount');
  }
  for (const [k, v] of demo.variants.entries()) {
    for (let j = 0; j < share[k]; j += 1) {
      const sourceId = `landing-${v.id}-${j}`;
      const existing = await prisma.smsMessage.findUnique({
        where: { userId_sourceId: { userId: mobile.id, sourceId } },
      });
      if (existing) continue;
      const message = await prisma.smsMessage.create({ data: {
        userId: mobile.id, clusterId: campaign.id, campaignMatchSource: 'model', trusted: true,
        sender: demo.alert.sender, body: `${v.lead} ${v.cta}: ${v.domain}`, sourceId,
        // Latest receipt per variant lands exactly at 9:38 on its day.
        receivedAt: new Date(firstSeen.getTime() + (v.day - 1) * DAY - (share[k] - 1 - j) * 7 * 60_000),
      } });
      // Model confidence is its own number, not the landing page's similarity.
      await prisma.classification.create({ data: {
        messageId: message.id, label: 'Scam', score: 0.95 + ((j * 7 + k * 3) % 5) / 100, bucket: 'blocked',
      } });
      await prisma.alert.create({ data: { messageId: message.id, status: 'Pending' } });
    }
  }
  return { admin, mobile, campaign };
}

const fixture = await seed();
const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
app.setGlobalPrefix('api');
app.enableCors({ origin: WEB, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
const express = app.getHttpAdapter().getInstance();
express.get('/demo/campaign-id', (_req, res) => res.json({ id: fixture.campaign.id }));
express.get('/demo/admin', (req, res) => {
  res.cookie('bantai_admin_session', jwt(fixture.admin.id, 'bantai-admin-api'), { httpOnly: true, sameSite: 'lax', path: '/' });
  const to = typeof req.query.to === 'string' && req.query.to.startsWith('/') ? req.query.to : `/admin/campaigns/${fixture.campaign.id}`;
  res.redirect(`${WEB}${to}`);
});
await app.listen(3101, '127.0.0.1');
console.log(`Landing demo API on 127.0.0.1:3101; campaign ${fixture.campaign.id}`);

const stop = async () => { await app.close(); await prisma.$disconnect(); };
process.on('SIGINT', () => { void stop().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void stop().then(() => process.exit(0)); });
