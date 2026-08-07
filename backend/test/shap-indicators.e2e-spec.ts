import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from './../database/prisma.service';
import { AiService, ClassificationResult } from './../src/ai/ai.service';
import { AppModule } from './../src/app.module';

/**
 * WBS 3.4.3 — SHAP output flows from ML service to mobile display.
 *
 * Verifies the asynchronous explainability pipeline described in
 * docs/api/explainability.md:
 *
 *   1. Mobile ingests an SMS and receives a messageId immediately.
 *      GET /sms/:messageId/indicators returns { indicators: [] } at this point
 *      because SHAP has not yet run.
 *
 *   2. The AI/ML service computes SHAP values asynchronously and POSTs them to
 *      POST /sms/:messageId/indicators (protected by ApiKeyGuard, not JWT).
 *
 *   3. Mobile re-fetches GET /sms/:messageId/indicators (JWT) and now receives
 *      the stored indicator tags with weights sorted most-influential-first.
 *
 * AiService is overridden so the suite is hermetic — the Python service is not
 * required to run in CI. Full three-tier round trip with live SHAP weights is
 * verified manually as part of the Sprint 3 demo.
 *
 * Requires the dev database (docker compose up -d) and an applied schema.
 */
describe('SHAP indicators pipeline (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const TEST_PHONE = '+639171230099';
  const SCAM_SENDER = 'BDO-ALERT';
  const SCAM_BODY =
    'Your BDO account is at risk. Verify immediately at http://bit.ly/bdo-verify to avoid suspension.';
  const INTERNAL_KEY = 'test-internal-key-shap-e2e';

  const classify = jest.fn<Promise<ClassificationResult | null>, [string]>();

  const scamResult: ClassificationResult = {
    label: 'Scam',
    score: 0.93,
    scores: { Ham: 0.02, Spam: 0.05, Scam: 0.93 },
    bucket: 'blocked',
    maskedText:
      'Your [URL] account is at risk. Verify immediately at [URL] to avoid suspension.',
  };

  const sampleIndicators = [
    { tag: 'Suspicious URL', weight: 1.0 },
    { tag: 'Brand Impersonation', weight: 0.74 },
    { tag: 'Urgency Cue', weight: 0.51 },
  ];

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue({ classify })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.INTERNAL_API_KEY;
  });

  beforeEach(async () => {
    classify.mockReset();
    await cleanup();
  });

  async function cleanup() {
    const user = await prisma.user.findUnique({ where: { phone: TEST_PHONE } });
    if (user) {
      const messages = await prisma.smsMessage.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const messageIds = messages.map((m) => m.id);

      const classifications = await prisma.classification.findMany({
        where: { messageId: { in: messageIds } },
        select: { id: true },
      });
      const classificationIds = classifications.map((c) => c.id);

      await prisma.explainableIndicator.deleteMany({
        where: { classificationId: { in: classificationIds } },
      });
      await prisma.alert.deleteMany({
        where: { messageId: { in: messageIds } },
      });
      await prisma.classification.deleteMany({
        where: { messageId: { in: messageIds } },
      });
      await prisma.messageFeature.deleteMany({
        where: { messageId: { in: messageIds } },
      });
      await prisma.smsMessage.deleteMany({ where: { userId: user.id } });
      await prisma.blockedNumber.deleteMany({ where: { userId: user.id } });
    }
    await prisma.otpCode.deleteMany({ where: { phone: TEST_PHONE } });
    await prisma.user.deleteMany({ where: { phone: TEST_PHONE } });
  }

  async function authenticate(): Promise<string> {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/register')
      .send({ phone: TEST_PHONE })
      .expect(201);

    await request(server)
      .post('/api/auth/request-otp')
      .send({ phone: TEST_PHONE })
      .expect(201);

    const otp = await prisma.otpCode.findFirst({
      where: { phone: TEST_PHONE, verified: false },
      orderBy: { expiresAt: 'desc' },
    });
    expect(otp).not.toBeNull();

    const res = await request(server)
      .post('/api/auth/verify-otp')
      .send({ phone: TEST_PHONE, otp: otp!.code })
      .expect(201);

    return res.body.access_token as string;
  }

  async function ingestScamMessage(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sender: SCAM_SENDER,
        body: SCAM_BODY,
        receivedAt: new Date().toISOString(),
      })
      .expect(201);

    expect(res.body.messageId).toBeDefined();
    return res.body.messageId as string;
  }

  // ── Step 1: before SHAP arrives ─────────────────────────────────────────────

  it('returns empty indicators immediately after ingest (SHAP not yet computed)', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    const res = await request(app.getHttpServer())
      .get(`/api/sms/${messageId}/indicators`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ indicators: [] });
  });

  // ── Step 2: AI/ML service stores SHAP output ────────────────────────────────

  it('AI/ML service stores indicators via POST with API key', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('x-api-key', INTERNAL_KEY)
      .send({ indicators: sampleIndicators })
      .expect(201);
  });

  it('rejects POST indicators without a valid API key', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    // JWT token instead of API key — must be rejected
    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('Authorization', `Bearer ${token}`)
      .send({ indicators: sampleIndicators })
      .expect(401);
  });

  it('rejects POST indicators with a wrong API key', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('x-api-key', 'wrong-key')
      .send({ indicators: sampleIndicators })
      .expect(401);
  });

  // ── Step 3: mobile reads stored indicators ──────────────────────────────────

  it('mobile retrieves stored indicators after SHAP has been posted', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('x-api-key', INTERNAL_KEY)
      .send({ indicators: sampleIndicators })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/sms/${messageId}/indicators`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.indicators).toHaveLength(sampleIndicators.length);
    expect(res.body.indicators[0]).toMatchObject({
      tag: 'Suspicious URL',
      weight: 1.0,
    });
    expect(res.body.indicators[1]).toMatchObject({
      tag: 'Brand Impersonation',
      weight: 0.74,
    });
    expect(res.body.indicators[2]).toMatchObject({
      tag: 'Urgency Cue',
      weight: 0.51,
    });
  });

  it('POST indicators overwrites previously stored indicators (upsert)', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('x-api-key', INTERNAL_KEY)
      .send({ indicators: sampleIndicators })
      .expect(201);

    const revised = [{ tag: 'Prize Lure', weight: 1.0 }];
    await request(app.getHttpServer())
      .post(`/api/sms/${messageId}/indicators`)
      .set('x-api-key', INTERNAL_KEY)
      .send({ indicators: revised })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/sms/${messageId}/indicators`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.indicators).toHaveLength(1);
    expect(res.body.indicators[0].tag).toBe('Prize Lure');
  });

  // ── Auth boundary checks ─────────────────────────────────────────────────────

  it('rejects GET indicators without JWT', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const messageId = await ingestScamMessage(token);

    await request(app.getHttpServer())
      .get(`/api/sms/${messageId}/indicators`)
      .expect(401);
  });

  it('returns 404 when messageId does not exist', async () => {
    const token = await authenticate();

    await request(app.getHttpServer())
      .get('/api/sms/00000000-0000-0000-0000-000000000000/indicators')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
