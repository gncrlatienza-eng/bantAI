import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AuthAudience } from '../src/auth/constants';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { AiModelsKeyGuard } from '../src/auth/guards/api-key.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { CampaignsController } from '../src/campaigns/campaigns.controller';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { InternalModelsController } from '../src/models/internal-models.controller';
import { ModelsController } from '../src/models/models.controller';
import { ModelsService } from '../src/models/models.service';

class HeaderJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    if (!req.headers.authorization) throw new UnauthorizedException();
    const authorization = req.headers.authorization;
    req.user = {
      userId: 'test-user',
      role:
        authorization === 'Bearer admin' ||
        authorization === 'Bearer mobile-admin'
          ? 'ADMIN'
          : 'USER',
      audience:
        authorization === 'Bearer admin'
          ? AuthAudience.ADMIN
          : authorization === 'Bearer mobile-admin'
            ? AuthAudience.MOBILE
            : AuthAudience.CLIENT,
    };
    return true;
  }
}

describe('authorization guard wiring (e2e)', () => {
  let app: INestApplication;
  const models = {
    findAll: jest.fn().mockResolvedValue([]),
    findActive: jest.fn().mockResolvedValue({ id: 'm1' }),
    register: jest.fn().mockResolvedValue({ id: 'm1' }),
    promote: jest.fn(),
    rollback: jest.fn(),
  };
  const campaigns = {
    findAll: jest.fn(),
    findAllCentroids: jest.fn(),
    findAllInactive: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    addDomains: jest.fn(),
    deactivate: jest.fn().mockResolvedValue({ id: 'c1' }),
  };

  beforeAll(async () => {
    process.env.AI_MODELS_API_KEY = 'e2e-model-key';
    const module = await Test.createTestingModule({
      controllers: [
        ModelsController,
        InternalModelsController,
        CampaignsController,
      ],
      providers: [
        AdminGuard,
        AiModelsKeyGuard,
        { provide: ModelsService, useValue: models },
        { provide: CampaignsService, useValue: campaigns },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderJwtGuard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  it('requires authentication and an administrator role for human model operations', async () => {
    await request(app.getHttpServer()).get('/api/models').expect(401);
    await request(app.getHttpServer())
      .get('/api/models')
      .set('Authorization', 'Bearer user')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/models')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/models')
      .set('Authorization', 'Bearer mobile-admin')
      .expect(403);
  });

  it('accepts a scoped machine key only on the internal model registry route', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/models')
      .send({ versionTag: 'v1', f1Score: 0.9 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/internal/models')
      .set('x-api-key', 'e2e-model-key')
      .send({ versionTag: 'v1', f1Score: 0.9 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/models')
      .set('x-api-key', 'e2e-model-key')
      .send({ versionTag: 'v1', f1Score: 0.9 })
      .expect(401);
  });

  it('requires an administrator JWT for public campaign deactivation', async () => {
    await request(app.getHttpServer())
      .patch('/api/campaigns/c1/deactivate')
      .set('Authorization', 'Bearer user')
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/campaigns/c1/deactivate')
      .set('Authorization', 'Bearer admin')
      .expect(200);
  });
});
