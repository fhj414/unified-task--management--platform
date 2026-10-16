import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';

const storedTokenKey = 'enterprise-hub.access-token';

const ada = {
  id: 'ada-id',
  email: 'ada.lovelace@enterprise-hub.local',
  name: 'Ada Lovelace',
  department: { id: 'engineering-id', name: 'Engineering' },
} as const;

const grace = {
  id: 'grace-id',
  email: 'grace.hopper@enterprise-hub.local',
  name: 'Grace Hopper',
  department: { id: 'operations-id', name: 'Operations' },
} as const;

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('restores a stored session after validating it with the authenticated endpoint', async () => {
    sessionStorage.setItem(storedTokenKey, 'stored-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ada), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const store = useAuthStore();

    await store.initialize();

    expect(fetchMock).toHaveBeenCalledWith('/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer stored-token' },
    }));
    expect(store.state).toBe('authenticated');
    expect(store.user).toEqual(ada);
  });

  it('clears an invalid stored token before loading mock users for anonymous login', async () => {
    sessionStorage.setItem(storedTokenKey, 'expired-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([ada, grace]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const store = useAuthStore();

    await store.initialize();

    expect(sessionStorage.getItem(storedTokenKey)).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/auth/mock-users');
    expect(store.state).toBe('anonymous');
    expect(store.mockUsers).toEqual([ada, grace]);
    expect(store.user).toBeUndefined();
  });

  it('stores a successful mock login token and user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'new-token', user: grace }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const store = useAuthStore();

    await store.login(grace.email);

    expect(fetchMock).toHaveBeenCalledWith('/auth/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: grace.email }),
    });
    expect(sessionStorage.getItem(storedTokenKey)).toBe('new-token');
    expect(store.state).toBe('authenticated');
    expect(store.user).toEqual(grace);
  });

  it('returns a generic error and remains anonymous when mock login is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const store = useAuthStore();

    await expect(store.login(ada.email)).resolves.toBe('Unable to sign in. Please try again.');

    expect(store.state).toBe('anonymous');
    expect(store.user).toBeUndefined();
    expect(sessionStorage.getItem(storedTokenKey)).toBeNull();
  });

  it('clears the session token and current user on logout', async () => {
    sessionStorage.setItem(storedTokenKey, 'stored-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ada), { status: 200 }),
    ));
    const store = useAuthStore();
    await store.initialize();

    store.logout();

    expect(sessionStorage.getItem(storedTokenKey)).toBeNull();
    expect(store.state).toBe('anonymous');
    expect(store.user).toBeUndefined();
  });
});
