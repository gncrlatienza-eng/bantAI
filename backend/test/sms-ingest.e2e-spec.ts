import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from './../database/prisma.service';
import { AiService, ClassificationResult } from './../src/ai/ai.service';
import { AppModule } from './../src/app.module';

/**
 * WBS 2.4.3 — mobile → backend → ML round trip.
 *
 * Exercises POST /api/sms/ingest with the exact payload the Android
 * SmsReceiver sends (see mobile/.../data/remote/SmsApi.kt), asserting that the
 * message, its preprocessed features, and its classification are all persisted
 * and that the routing decision comes back in the shape the app maps to a
 * notification.
 *
 * AiService is overridden so the suite is hermetic — the Python service is not
 * required to run in CI. The AI-down case below covers the fallback path that
 * a real outage produces; the full three-tier round trip with live model
 * weights is verified manually as part of the Sprint 2 demo.
 *
 * Requires the dev database (docker compose up -d) and an applied schema.
 */
describe('SMS ingest (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const TEST_PHONE = '+639171230001';
  const SCAM_SENDER = 'GCASH-ALERT';
  const SCAM_BODY =
    'Your GCash account is suspended. Verify now at http://bit.ly/verify-gc to avoid permanent lock.';

  // Reconfigured per test, so a single override serves every scenario.
  const classify = jest.fn<Promise<ClassificationResult | null>, [string]>();

  /** Mirrors the AI service's Scam verdict at auto-block confidence. */
  const scamResult: ClassificationResult = {
    label: 'Scam',
    score: 0.97,
    scores: { Ham: 0.01, Spam: 0.02, Scam: 0.97 },
    bucket: 'blocked',
    maskedText: 'Your [URL] account is suspended. Verify now at [URL]',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue({ classify })
      .compile();

    app = moduleFixture.createNestApplication();

    // main.ts applies these at bootstrap rather than in AppModule, so the test
    // has to reproduce them or routes and validation will not match production.
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
  });

  beforeEach(async () => {
    classify.mockReset();
    await cleanup();
  });

  /**
   * Deletes in dependency order — the schema declares no cascade rules, so
   * children must go before their parents.
   */
  async function cleanup() {
    const user = await prisma.user.findUnique({ where: { phone: TEST_PHONE } });
    if (user) {
      const messages = await prisma.smsMessage.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const messageIds = messages.map((m) => m.id);

      await prisma.classification.deleteMany({
        where: { messageId: { in: messageIds } },
      });
      await prisma.messageFeature.deleteMany({
        where: { messageId: { in: messageIds } },
      });
      await prisma.smsMessage.deleteMany({ where: { userId: user.id } });
      await prisma.blockedNumber.deleteMany({ where: { userId: user.id } });
      await prisma.contact.deleteMany({ where: { userId: user.id } });
    }
    await prisma.otpCode.deleteMany({ where: { phone: TEST_PHONE } });
    await prisma.user.deleteMany({ where: { phone: TEST_PHONE } });
  }

  /**
   * Runs the real onboarding flow the app uses. There is no SMS gateway in
   * test, but requestOtp persists the code (auth.service.ts), so it can be read
   * straight from the database.
   */
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

    expect(res.body.access_token).toBeDefined();
    return res.body.access_token as string;
  }

  /** The exact body SmsApi.ingest sends, including ISO-8601 receivedAt. */
  function ingestPayload(sender: string, body: string) {
    return { sender, body, receivedAt: new Date().toISOString() };
  }

  it('rejects ingest without a JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .send(ingestPayload(SCAM_SENDER, SCAM_BODY))
      .expect(401);

    expect(classify).not.toHaveBeenCalled();
  });

  it('classifies via the AI service and persists message, features, and result', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();

    const res = await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send(ingestPayload(SCAM_SENDER, SCAM_BODY))
      .expect(201);

    // The AI service received the raw body, not a pre-masked one.
    expect(classify).toHaveBeenCalledWith(SCAM_BODY);

    // Response shape is what SmsApi.parseIngestResponse reads.
    expect(res.body).toMatchObject({
      classification: { label: 'Scam', score: 0.97 },
      action: 'blocked',
      senderStatus: 'unknown',
    });
    expect(typeof res.body.messageId).toBe('string');
    // bit.ly is a known shortener, so the link is withheld from the app.
    expect(res.body.suppressedLinks).toContain('http://bit.ly/verify-gc');

    const messageId = res.body.messageId as string;

    const stored = await prisma.smsMessage.findUnique({
      where: { id: messageId },
    });
    expect(stored).toMatchObject({ sender: SCAM_SENDER, body: SCAM_BODY });

    const feature = await prisma.messageFeature.findUnique({
      where: { messageId },
    });
    expect(feature?.maskedBody).toBe(scamResult.maskedText);
    expect(feature?.normalizedBody).toBe(SCAM_BODY.normalize('NFKC'));

    const classification = await prisma.classification.findUnique({
      where: { messageId },
    });
    expect(classification).toMatchObject({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
    });
  });

  it('falls back to the local heuristic when the AI service is unavailable', async () => {
    // null is what AiService returns on a 503 or an unreachable service.
    classify.mockResolvedValue(null);
    const token = await authenticate();

    const res = await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send(ingestPayload(SCAM_SENDER, SCAM_BODY))
      .expect(201);

    expect(['Ham', 'Spam', 'Scam']).toContain(res.body.classification.label);
    expect(['blocked', 'alert', 'inbox']).toContain(res.body.action);

    // The fallback still has to produce a full, persisted record — the app
    // cannot tell the difference and neither can the dashboard.
    const classification = await prisma.classification.findUnique({
      where: { messageId: res.body.messageId as string },
    });
    expect(classification).not.toBeNull();
    // No AI call means no softmax distribution and no AI bucket.
    expect(classification?.bucket).toBeNull();

    const feature = await prisma.messageFeature.findUnique({
      where: { messageId: res.body.messageId as string },
    });
    // Local masking still redacts the URL before anything is stored.
    expect(feature?.maskedBody).toContain('[URL]');
  });

  it('auto-blocks a high-confidence sender and suppresses their next message', async () => {
    classify.mockResolvedValue(scamResult);
    const token = await authenticate();
    const server = app.getHttpServer();

    await request(server)
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send(ingestPayload(SCAM_SENDER, SCAM_BODY))
      .expect(201);

    const blocked = await prisma.blockedNumber.findFirst({
      where: { sender: SCAM_SENDER },
    });
    expect(blocked?.source).toBe('AutoBlock');

    // Second message from the same sender short-circuits before any AI call.
    classify.mockClear();
    const second = await request(server)
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send(ingestPayload(SCAM_SENDER, 'Another attempt from the same sender'))
      .expect(201);

    expect(second.body).toEqual({
      suppressed: true,
      reason: 'blocked_sender',
    });
    expect(classify).not.toHaveBeenCalled();

    // Nothing was persisted for the suppressed message.
    const messages = await prisma.smsMessage.findMany({
      where: { sender: SCAM_SENDER },
    });
    expect(messages).toHaveLength(1);
  });

  it('routes a benign message to the inbox without blocking the sender', async () => {
    classify.mockResolvedValue({
      label: 'Ham',
      score: 0.94,
      scores: { Ham: 0.94, Spam: 0.04, Scam: 0.02 },
      bucket: 'safe',
      maskedText: 'Hi, are we still meeting at [OTP]pm later?',
    });
    const token = await authenticate();

    const res = await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send(ingestPayload('+639179876543', 'Hi, are we still meeting at 5pm later?'))
      .expect(201);

    expect(res.body.action).toBe('inbox');

    // Score is high but the label is Ham — auto-block must key off the routing
    // decision, never raw confidence.
    const blocked = await prisma.blockedNumber.findFirst({
      where: { sender: '+639179876543' },
    });
    expect(blocked).toBeNull();
  });

  it('rejects a payload whose receivedAt is not a date string', async () => {
    const token = await authenticate();

    await request(app.getHttpServer())
      .post('/api/sms/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({ sender: SCAM_SENDER, body: SCAM_BODY, receivedAt: Date.now() })
      .expect(400);
  });
});
