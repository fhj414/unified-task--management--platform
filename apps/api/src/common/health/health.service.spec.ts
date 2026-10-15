import { Logger } from '@nestjs/common';
import { HealthService } from './health.service';

interface DependencyProbes {
  checkConnection: () => Promise<void>;
  ping: () => Promise<void>;
}

function createService(overrides: Partial<DependencyProbes> = {}): HealthService {
  const database = {
    checkConnection: overrides.checkConnection ?? (() => Promise.resolve()),
  };
  const redis = {
    ping: overrides.ping ?? (() => Promise.resolve()),
  };

  return new HealthService(database, redis);
}

describe('HealthService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports every component up when both dependency probes succeed', async () => {
    const result = await createService().check();

    expect(result.status).toBe('up');
    expect(result.services).toEqual({
      api: 'up',
      database: 'up',
      redis: 'up',
    });
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('reports the database down while Redis remains up when only the database probe fails', async () => {
    const result = await createService({
      checkConnection: () => Promise.reject(new Error('private database error')),
    }).check();

    expect(result.status).toBe('down');
    expect(result.services).toEqual({
      api: 'up',
      database: 'down',
      redis: 'up',
    });
    expect(JSON.stringify(result)).not.toContain('private database error');
  });

  it('reports Redis down while the database remains up when only the Redis probe fails', async () => {
    const result = await createService({
      ping: () => Promise.reject(new Error('private Redis error')),
    }).check();

    expect(result.status).toBe('down');
    expect(result.services).toEqual({
      api: 'up',
      database: 'up',
      redis: 'down',
    });
    expect(JSON.stringify(result)).not.toContain('private Redis error');
  });

  it('reports both dependencies down when both probes fail independently', async () => {
    const result = await createService({
      checkConnection: () => Promise.reject(new Error('private database error')),
      ping: () => Promise.reject(new Error('private Redis error')),
    }).check();

    expect(result.status).toBe('down');
    expect(result.services).toEqual({
      api: 'up',
      database: 'down',
      redis: 'down',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private database error|private Redis error/,
    );
  });
});
