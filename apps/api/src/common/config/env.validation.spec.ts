import { validateEnvironment } from './env.validation';

const baseEnvironment = {
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/enterprise_hub',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6380',
  CORS_ORIGIN: 'http://localhost:5173',
};

const validConfig = {
  ...baseEnvironment,
  JWT_SECRET: 'local-development-jwt-secret-change-me',
};

describe('validateEnvironment', () => {
  it('coerces numeric values and excludes unrelated environment keys', () => {
    const result = validateEnvironment({ ...validConfig, SHELL: '/bin/zsh' });

    expect(result).toEqual({
      PORT: 4000,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/enterprise_hub',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6380,
      CORS_ORIGIN: 'http://localhost:5173',
      JWT_SECRET: 'local-development-jwt-secret-change-me',
      JWT_EXPIRES_IN: '1h',
    });
  });

  it('defaults omitted service ports', () => {
    const result = validateEnvironment({
      ...validConfig,
      PORT: undefined,
      REDIS_PORT: undefined,
    });

    expect(result.PORT).toBe(3000);
    expect(result.REDIS_PORT).toBe(6379);
  });

  it.each(['DATABASE_URL', 'REDIS_HOST'] as const)(
    'rejects a missing %s value with a useful message',
    (key) => {
      expect(() =>
        validateEnvironment({ ...validConfig, [key]: undefined }),
      ).toThrow(new RegExp(key));
    },
  );

  it('rejects a CORS origin that is not a URI', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, CORS_ORIGIN: 'not a uri' }),
    ).toThrow(/CORS_ORIGIN/);
  });

  it('rejects an omitted JWT secret', () => {
    expect(() => validateEnvironment(baseEnvironment)).toThrow(/JWT_SECRET/);
  });

  it('defaults the JWT expiry for a valid secret', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        JWT_SECRET: 'local-development-jwt-secret-change-me',
      }),
    ).toMatchObject({ JWT_EXPIRES_IN: '1h' });
  });
});
