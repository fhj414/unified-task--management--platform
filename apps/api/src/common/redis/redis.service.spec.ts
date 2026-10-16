import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';
import { RedisService } from './redis.service';

jest.mock('ioredis');

interface RedisClientDouble {
  connect: jest.Mock<Promise<void>, []>;
  on: jest.Mock<Redis, [string, (...args: unknown[]) => void]>;
  quit: jest.Mock<Promise<'OK'>, []>;
  ping: jest.Mock<Promise<string>, []>;
}

const RedisMock = Redis as jest.MockedClass<typeof Redis>;

function createConfigService(): ConfigService<EnvironmentVariables, true> {
  const values: Pick<EnvironmentVariables, 'REDIS_HOST' | 'REDIS_PORT'> = {
    REDIS_HOST: 'redis.internal',
    REDIS_PORT: 6381,
  };

  return {
    get: jest.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('RedisService', () => {
  let client: RedisClientDouble;

  beforeEach(() => {
    client = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
      quit: jest.fn().mockResolvedValue('OK'),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    RedisMock.mockImplementation(() => client as unknown as Redis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('constructs a lazy Redis client from the configured host and port', () => {
    new RedisService(createConfigService());

    expect(RedisMock).toHaveBeenCalledWith({
      host: 'redis.internal',
      port: 6381,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  });

  it('registers an error listener so an unavailable Redis server is not an unhandled event', () => {
    new RedisService(createConfigService());

    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('connects the Redis client during module initialization', async () => {
    const service = new RedisService(createConfigService());

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('quits the Redis client during module destruction', async () => {
    const service = new RedisService(createConfigService());

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it('accepts PONG as a healthy Redis response', async () => {
    const service = new RedisService(createConfigService());

    await expect(service.ping()).resolves.toBeUndefined();
  });

  it('rejects any Redis ping response other than PONG', async () => {
    client.ping.mockResolvedValue('NOT_PONG');
    const service = new RedisService(createConfigService());

    await expect(service.ping()).rejects.toBeInstanceOf(Error);
  });

  it('propagates Redis connection failures from ping', async () => {
    const error = new Error('redis unavailable');
    client.ping.mockRejectedValue(error);
    const service = new RedisService(createConfigService());

    await expect(service.ping()).rejects.toBe(error);
  });
});
