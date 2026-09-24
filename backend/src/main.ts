import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ADMIN_SESSION_COOKIE, CLIENT_SESSION_COOKIE } from './auth/constants';

function assertRequiredConfiguration() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OTP_HASH_SECRET',
    'SENDER_HASH_SECRET',
    // The backend must authenticate to the AI service outside local
    // development. Leaving this unset silently turns every AI response into
    // a non-authoritative fallback after the service rejects the request.
    'AI_SERVICE_API_KEY',
    'AI_CAMPAIGNS_API_KEY',
    'AI_MODELS_API_KEY',
    'AI_INDICATORS_API_KEY',
    'SEMAPHORE_API_KEY',
  ];
  if (process.env.NODE_ENV === 'production') {
    required.push(
      'EMAIL_OTP_HASH_SECRET',
      'GMAIL_SMTP_USER',
      'GMAIL_SMTP_APP_PASSWORD',
      'CLIENT_JWT_SECRET',
      'ADMIN_JWT_SECRET',
    );
  }
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS;
  const origins = (configured ?? 'http://localhost:3001,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production' && !configured) {
    throw new Error('CORS_ORIGINS must be set in production.');
  }

  return origins;
}

async function bootstrap() {
  assertRequiredConfiguration();
  const logger = new Logger('Bootstrap');
  const app: INestApplication = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Stripe signature verification requires the exact raw body Stripe signed.
    // Enabling rawBody here makes `req.rawBody` available on every request,
    // and we install a route-scoped raw parser below for the webhook path
    // specifically so JSON parsing keeps working everywhere else.
    rawBody: true,
  });

  // Express must trust only the exact number of deployed reverse proxies;
  // otherwise client-controlled forwarded headers can defeat IP throttling.
  const proxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10);
  if (Number.isInteger(proxyHops) && proxyHops > 0) {
    // Nest declares the adapter instance as `any`; Express's `set` contract is
    // narrowed here so the unsafe framework boundary remains contained.
    const express = app.getHttpAdapter().getInstance() as {
      set(setting: string, value: number): void;
    };
    express.set('trust proxy', proxyHops);
  }

  // Security headers — must be before any route registration
  app.use(helmet());

  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // SameSite cookies are the first CSRF boundary. For cookie-authenticated
  // state changes, also require an explicitly allowed browser Origin. Mobile
  // bearer-token requests do not carry the portal cookie and remain unchanged.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const hasPortalCookie = (req.headers.cookie ?? '')
      .split(';')
      .some((part) => {
        const cookie = part.trim();
        return (
          cookie.startsWith(`${CLIENT_SESSION_COOKIE}=`) ||
          cookie.startsWith(`${ADMIN_SESSION_COOKIE}=`)
        );
      });
    if (mutating && hasPortalCookie) {
      const origin = req.headers.origin;
      if (!origin || !allowedOrigins.includes(origin)) {
        res.status(403).json({ message: 'Origin is not allowed.' });
        return;
      }
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  if (
    process.env.API_DOCS_ENABLED === 'true' ||
    process.env.NODE_ENV !== 'production'
  ) {
    const openApiConfig = new DocumentBuilder()
      .setTitle('bantAI API')
      .setDescription(
        'REST API for bantAI SMS protection, reporting, and model operations.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, openApiConfig, {
      deepScanRoutes: true,
      autoTagControllers: true,
    });
    SwaggerModule.setup('docs', app, openApiDocument, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Server running at http://localhost:${port}/api`);
  if (
    process.env.API_DOCS_ENABLED === 'true' ||
    process.env.NODE_ENV !== 'production'
  ) {
    logger.log(
      `OpenAPI documentation available at http://localhost:${port}/api/docs`,
    );
  }
}

void bootstrap();
