import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ComponentStatus, HealthResponse } from '@enterprise-hub/shared';

export type ConnectionState =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'unavailable';

function isComponentStatus(value: unknown): value is ComponentStatus {
  return value === 'up' || value === 'down';
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const response = value as Record<string, unknown>;
  const services = response.services;

  if (
    typeof services !== 'object' ||
    services === null ||
    Array.isArray(services)
  ) {
    return false;
  }

  const serviceStatuses = services as Record<string, unknown>;

  return (
    isComponentStatus(response.status) &&
    typeof response.timestamp === 'string' &&
    isComponentStatus(serviceStatuses.api) &&
    isComponentStatus(serviceStatuses.database) &&
    isComponentStatus(serviceStatuses.redis)
  );
}

export const useHealthStore = defineStore('health', () => {
  const state = ref<ConnectionState>('idle');
  const health = ref<HealthResponse>();
  let latestRequestId = 0;

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
    const requestId = ++latestRequestId;
    state.value = 'loading';
    health.value = undefined;

    try {
      const response = await fetch('/health');
      const body: unknown = await response.json();

      if (requestId !== latestRequestId) {
        return;
      }

      if (!isHealthResponse(body)) {
        state.value = 'unavailable';
        return;
      }

      health.value = body;
      state.value = response.ok && body.status === 'up' ? 'connected' : 'unavailable';
    } catch {
      if (requestId === latestRequestId) {
        state.value = 'unavailable';
      }
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
