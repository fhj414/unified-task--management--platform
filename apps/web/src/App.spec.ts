import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import { useAuthStore } from './stores/auth';
import { useHealthStore } from './stores/health';

const ada = {
  id: 'ada-id',
  email: 'ada.lovelace@enterprise-hub.local',
  name: 'Ada Lovelace',
  department: { id: 'engineering-id', name: 'Engineering' },
} as const;

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the mock account chooser after anonymous initialization', () => {
    const authStore = useAuthStore();
    authStore.state = 'anonymous';
    authStore.mockUsers = [ada];
    vi.spyOn(authStore, 'initialize').mockResolvedValue();
    vi.spyOn(useHealthStore(), 'loadHealth').mockResolvedValue();

    const wrapper = mount(App);

    expect(wrapper.get('h1').text()).toBe('Choose a mock account');
  });

  it('shows the current user in the dashboard header and supports logout', async () => {
    const authStore = useAuthStore();
    authStore.state = 'authenticated';
    authStore.user = ada;
    authStore.mockUsers = [ada];
    vi.spyOn(authStore, 'initialize').mockResolvedValue();
    vi.spyOn(useHealthStore(), 'loadHealth').mockResolvedValue();

    const wrapper = mount(App);

    expect(wrapper.get('.current-user').text()).toContain('Ada Lovelace');
    await wrapper.get('button').trigger('click');
    expect(authStore.state).toBe('anonymous');
  });
});
