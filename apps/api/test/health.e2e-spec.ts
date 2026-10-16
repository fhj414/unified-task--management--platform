import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApplication } from '../src/app.configuration';
import { EnvironmentVariables } from '../src/common/config/env.validation';
import { PrismaService } from '../src/common/database/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

interface ProbeOverrides {
  checkConnection?: () => Promise<void>;
  ping?: () => Promise<void>;
}

class ValidationProbeBody {
  @IsString()
  name!: string;
}

@Controller('validation-probe')
class ValidationProbeController {
  @Post()
  create(@Body() body: ValidationProbeBody): ValidationProbeBody {
    return body;
  }
}

async function createApp(
  overrides: ProbeOverrides = {},
): Promise<INestApplication> {
  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ValidationProbeController],
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
  configureApplication(
    app,
    app.get(ConfigService<EnvironmentVariables, true>),
  );
  await app.init();

  return app;
}

describe('GET /health', () => {
  let app: INestApplication | undefined;
  const testEnvironment = {
    PORT: '3000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    CORS_ORIGIN: 'http://localhost:5173',
  };
  const originalEnvironment = Object.fromEntries(
    Object.keys(testEnvironment).map((key) => [key, process.env[key]]),
  );

  beforeAll(() => {
    Object.assign(process.env, testEnvironment);
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

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

  it('serves the Swagger UI and documents the health response body', async () => {
    app = await createApp();

    await request(app.getHttpServer()).get('/docs/').expect(200);
    const document = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(
      document.body.paths['/health'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/HealthResponseDto' });
  });

  it('applies global validation and the public exception response shape', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post('/validation-probe')
      .send({ name: 'Ada', unexpected: true })
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: ['property unexpected should not exist'],
      path: '/validation-probe',
      timestamp: expect.any(String),
    });
  });

  it('registers application shutdown hooks', async () => {
    const listenersBefore = process.listenerCount('SIGTERM');

    app = await createApp();

    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(listenersBefore);
  });
});
