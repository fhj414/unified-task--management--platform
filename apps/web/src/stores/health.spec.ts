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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

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

  it('does not connect when a 503 response body incorrectly claims to be up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthyResponse), { status: 503 }),
      ),
    );
    const store = useHealthStore();

    await store.loadHealth();

    expect(store.state).toBe('unavailable');
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

  it('does not retain malformed JSON health data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'unavailable' }), { status: 200 }),
      ),
    );
    const store = useHealthStore();

    await expect(store.loadHealth()).resolves.toBeUndefined();

    expect(store.state).toBe('unavailable');
    expect(store.health).toBeUndefined();
    expect(store.isLoading).toBe(false);
  });

  it('keeps the newest health result when an earlier request resolves last', async () => {
    const earlierRequest = createDeferred<Response>();
    const newerRequest = createDeferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() => earlierRequest.promise)
        .mockImplementationOnce(() => newerRequest.promise),
    );
    const store = useHealthStore();

    const earlierLoad = store.loadHealth();
    const newerLoad = store.loadHealth();

    newerRequest.resolve(
      new Response(
        JSON.stringify({
          ...healthyResponse,
          timestamp: '2026-10-15T08:05:00.000Z',
        }),
        { status: 200 },
      ),
    );
    await newerLoad;
    earlierRequest.resolve(
      new Response(JSON.stringify(unavailableResponse), { status: 503 }),
    );
    await earlierLoad;

    expect(store.state).toBe('connected');
    expect(store.health?.timestamp).toBe('2026-10-15T08:05:00.000Z');
    expect(store.isLoading).toBe(false);
  });
});
