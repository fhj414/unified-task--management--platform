import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/common/database/prisma.service';
import { HealthModule } from '../src/common/health/health.module';
import { RedisService } from '../src/common/redis/redis.service';

interface ProbeOverrides {
  checkConnection?: () => Promise<void>;
  ping?: () => Promise<void>;
}

async function createApp(
  overrides: ProbeOverrides = {},
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      checkConnection: overrides.checkConnection ?? (() => Promise.resolve()),
    })
    .overrideProvider(RedisService)
    .useValue({ ping: overrides.ping ?? (() => Promise.resolve()) })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  await app.init();

  return app;
}

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns 200 with the shared health shape when all dependencies are up', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'up',
      timestamp: expect.any(String),
      services: { api: 'up', database: 'up', redis: 'up' },
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('returns 503 and preserves dependency statuses when a dependency is down', async () => {
    app = await createApp({
      checkConnection: () => Promise.reject(new Error('private database error')),
    });

    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body).toEqual({
      status: 'down',
      timestamp: expect.any(String),
      services: { api: 'up', database: 'down', redis: 'up' },
    });
    expect(JSON.stringify(response.body)).not.toContain('private database error');
  });
});
