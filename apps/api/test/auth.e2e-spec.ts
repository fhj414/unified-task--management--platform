import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/app.configuration';
import { EnvironmentVariables } from '../src/common/config/env.validation';
import { PrismaService } from '../src/common/database/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

const mockUsers = [
  {
    id: 'ada-id',
    email: 'ada.lovelace@enterprise-hub.local',
    name: 'Ada Lovelace',
    departmentId: 'engineering-id',
    department: { id: 'engineering-id', name: 'Engineering' },
    createdAt: new Date('2026-10-16T00:00:00.000Z'),
    updatedAt: new Date('2026-10-16T00:00:00.000Z'),
  },
  {
    id: 'grace-id',
    email: 'grace.hopper@enterprise-hub.local',
    name: 'Grace Hopper',
    departmentId: null,
    department: null,
    createdAt: new Date('2026-10-16T00:00:00.000Z'),
    updatedAt: new Date('2026-10-16T00:00:00.000Z'),
  },
];

async function createApp(): Promise<INestApplication> {
  const { AppModule } = await import('../src/app.module');
  const prisma = {
    user: {
      findMany: jest.fn(() => Promise.resolve(mockUsers)),
      findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(
          mockUsers.find(
            (user) => user.id === where.id || user.email === where.email,
          ) ?? null,
        ),
      ),
    },
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RedisService)
    .useValue({ ping: () => Promise.resolve() })
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

describe('mock JWT authentication endpoints', () => {
  let app: INestApplication | undefined;
  const testEnvironment = {
    PORT: '3000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    CORS_ORIGIN: 'http://localhost:5173',
    JWT_SECRET: 'local-development-jwt-secret-change-me',
    JWT_EXPIRES_IN: '1h',
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

  it('lists public mock users without raw Prisma timestamps', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get('/auth/mock-users')
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 'ada-id',
        email: 'ada.lovelace@enterprise-hub.local',
        name: 'Ada Lovelace',
        department: { id: 'engineering-id', name: 'Engineering' },
      },
      {
        id: 'grace-id',
        email: 'grace.hopper@enterprise-hub.local',
        name: 'Grace Hopper',
        department: null,
      },
    ]);
  });

  it('issues an access token for a known mock user', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post('/auth/mock-login')
      .send({ email: 'ada.lovelace@enterprise-hub.local' })
      .expect(201);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      user: {
        id: 'ada-id',
        email: 'ada.lovelace@enterprise-hub.local',
        name: 'Ada Lovelace',
        department: { id: 'engineering-id', name: 'Engineering' },
      },
    });
  });

  it('returns the public 401 shape for an unknown mock user', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post('/auth/mock-login')
      .send({ email: 'unknown@enterprise-hub.local' })
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
      path: '/auth/mock-login',
      timestamp: expect.any(String),
    });
  });

  it('returns the public 401 shape when /auth/me has no token', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer()).get('/auth/me').expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
      path: '/auth/me',
      timestamp: expect.any(String),
    });
  });

  it('returns the current user from an access token created by login', async () => {
    app = await createApp();
    const login = await request(app.getHttpServer())
      .post('/auth/mock-login')
      .send({ email: 'ada.lovelace@enterprise-hub.local' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 'ada-id',
      email: 'ada.lovelace@enterprise-hub.local',
      name: 'Ada Lovelace',
      department: { id: 'engineering-id', name: 'Engineering' },
    });
  });

  it('does not leak JWT verification details for an invalid token', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid or expired access token',
      path: '/auth/me',
      timestamp: expect.any(String),
    });
  });

  it('documents the mock auth endpoints and scopes Bearer auth to /auth/me', async () => {
    app = await createApp();

    const document = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(document.body.paths['/auth/mock-users'].get.responses['200'].content[
      'application/json'
    ].schema).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/AuthUserDto' },
    });
    expect(document.body.paths['/auth/mock-login'].post.responses['201'].content[
      'application/json'
    ].schema).toEqual({ $ref: '#/components/schemas/MockLoginResponseDto' });
    expect(document.body.paths['/auth/me'].get.security).toEqual([{ bearer: [] }]);
    expect(document.body.paths['/auth/mock-users'].get.security).toBeUndefined();
    expect(document.body.paths['/auth/mock-login'].post.security).toBeUndefined();
  });
});
