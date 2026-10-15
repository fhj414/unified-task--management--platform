import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHealthStore } from './health';

const healthyResponse = {
  status: 'up',
  timestamp: '2026-10-15T08:00:00.000Z',
  services: {
    api: 'up',
    database: 'up',
    redis: 'up',
  },
} as const;

const unavailableResponse = {
  status: 'down',
  timestamp: '2026-10-15T08:00:00.000Z',
  services: {
    api: 'up',
    database: 'down',
    redis: 'down',
  },
} as const;

describe('health store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
  });

  it('connects when a successful response reports every service shape and an up status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthyResponse), { status: 200 }),
      ),
    );
    const store = useHealthStore();

    await store.loadHealth();

    expect(store.state).toBe('connected');
    expect(store.health?.services.database).toBe('up');
    expect(store.connectionLabel).toBe('Connected');
  });

  it('reports unavailable without throwing when the health endpoint responds 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(unavailableResponse), { status: 503 }),
      ),
    );
    const store = useHealthStore();

    await expect(store.loadHealth()).resolves.toBeUndefined();

    expect(store.state).toBe('unavailable');
    expect(store.health?.services.redis).toBe('down');
    expect(store.connectionLabel).toBe('Unavailable');
  });

  it('reports unavailable and finishes loading when the health request is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const store = useHealthStore();

    await expect(store.loadHealth()).resolves.toBeUndefined();

    expect(store.state).toBe('unavailable');
    expect(store.isLoading).toBe(false);
  });

  it('reports unavailable without throwing when the health body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{not valid json}', { status: 200 }),
      ),
    );
    const store = useHealthStore();

    await expect(store.loadHealth()).resolves.toBeUndefined();

    expect(store.state).toBe('unavailable');
    expect(store.isLoading).toBe(false);
  });
});
