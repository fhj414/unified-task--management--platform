import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { HealthResponse } from '@enterprise-hub/shared';

export type ConnectionState =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'unavailable';

export const useHealthStore = defineStore('health', () => {
  const state = ref<ConnectionState>('idle');
  const health = ref<HealthResponse>();

  const isLoading = computed(() => state.value === 'loading');
  const connectionLabel = computed(() => {
    switch (state.value) {
      case 'connected':
        return 'Connected';
      case 'unavailable':
        return 'Unavailable';
      case 'loading':
        return 'Checking connection';
      default:
        return 'Not checked';
    }
  });

  async function loadHealth(): Promise<void> {
    state.value = 'loading';
    health.value = undefined;

    try {
      const response = await fetch('/health');
      const body = (await response.json()) as HealthResponse;

      health.value = body;
      state.value = response.ok && body.status === 'up' ? 'connected' : 'unavailable';
    } catch {
      state.value = 'unavailable';
    }
  }

  return {
    state,
    health,
    isLoading,
    connectionLabel,
    loadHealth,
  };
});
