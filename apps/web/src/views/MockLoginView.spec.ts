import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MockLoginView from './MockLoginView.vue';
import { useAuthStore } from '../stores/auth';

const mockUser = {
  id: 'ada-id',
  email: 'ada.lovelace@enterprise-hub.local',
  name: 'Ada Lovelace',
  department: { id: 'engineering-id', name: 'Engineering' },
} as const;

describe('MockLoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
  });

  it('requires an account choice and presents a generic error for a rejected login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const store = useAuthStore();
    store.mockUsers = [mockUser];
    store.state = 'anonymous';
    const wrapper = mount(MockLoginView);

    const selector = wrapper.get('select#mock-account');
    const submit = wrapper.get('button[type="submit"]');
    expect(selector.attributes('aria-label')).toBe('Mock account');
    expect(submit.attributes('disabled')).toBeDefined();

    await selector.setValue(mockUser.email);
    expect(submit.attributes()).not.toHaveProperty('disabled');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe('Unable to sign in. Please try again.');
  });
});
