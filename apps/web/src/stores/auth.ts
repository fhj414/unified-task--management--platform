import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AuthenticatedUser, MockLoginResponse } from '@enterprise-hub/shared';

export type AuthState = 'loading' | 'anonymous' | 'authenticated';

const accessTokenKey = 'enterprise-hub.access-token';
const loginError = 'Unable to sign in. Please try again.';

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export const useAuthStore = defineStore('auth', () => {
  const state = ref<AuthState>('loading');
  const user = ref<AuthenticatedUser>();
  const mockUsers = ref<AuthenticatedUser[]>([]);
  const error = ref<string>();

  async function loadMockUsers(): Promise<void> {
    try {
      const response = await fetch('/auth/mock-users');
      mockUsers.value = response.ok ? await readJson<AuthenticatedUser[]>(response) : [];
    } catch {
      mockUsers.value = [];
    }
  }

  async function initialize(): Promise<void> {
    state.value = 'loading';
    user.value = undefined;
    error.value = undefined;
    const accessToken = sessionStorage.getItem(accessTokenKey);

    if (accessToken) {
      try {
        const response = await fetch('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          user.value = await readJson<AuthenticatedUser>(response);
          state.value = 'authenticated';
          return;
        }
      } catch {
        // An unavailable API should fall through to the anonymous mock-user flow.
      }

      sessionStorage.removeItem(accessTokenKey);
    }

    await loadMockUsers();
    state.value = 'anonymous';
  }

  async function login(email: string): Promise<string | undefined> {
    state.value = 'loading';
    user.value = undefined;
    error.value = undefined;

    try {
      const response = await fetch('/auth/mock-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        sessionStorage.removeItem(accessTokenKey);
        state.value = 'anonymous';
        error.value = loginError;
        return error.value;
      }

      const result = await readJson<MockLoginResponse>(response);
      sessionStorage.setItem(accessTokenKey, result.accessToken);
      user.value = result.user;
      state.value = 'authenticated';
      return undefined;
    } catch {
      sessionStorage.removeItem(accessTokenKey);
      state.value = 'anonymous';
      error.value = loginError;
      return error.value;
    }
  }

  async function logout(): Promise<void> {
    sessionStorage.removeItem(accessTokenKey);
    user.value = undefined;
    error.value = undefined;
    state.value = 'loading';
    await loadMockUsers();
    state.value = 'anonymous';
  }

  return {
    state,
    user,
    mockUsers,
    error,
    initialize,
    login,
    logout,
  };
});
