<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const selectedEmail = ref('');

async function submitLogin(): Promise<void> {
  if (!selectedEmail.value) {
    return;
  }

  await authStore.login(selectedEmail.value);
}
</script>

<template>
  <main class="login-page" aria-labelledby="login-heading">
    <section class="login-panel">
      <p class="eyebrow">Local development</p>
      <h1 id="login-heading">Choose a mock account</h1>
      <p class="login-description">
        Select one of the seeded demo accounts to open the Enterprise Hub preview.
      </p>

      <form class="login-form" @submit.prevent="submitLogin">
        <label for="mock-account">Mock account</label>
        <select id="mock-account" v-model="selectedEmail" aria-label="Mock account">
          <option disabled value="">Select an account</option>
          <option v-for="mockUser in authStore.mockUsers" :key="mockUser.id" :value="mockUser.email">
            {{ mockUser.name }} · {{ mockUser.department?.name ?? 'No department' }}
          </option>
        </select>

        <p v-if="authStore.error" class="form-error" role="alert">
          {{ authStore.error }}
        </p>

        <button type="submit" :disabled="!selectedEmail || authStore.state === 'loading'">
          Sign in to preview
        </button>
      </form>

      <p v-if="authStore.mockUsers.length === 0" class="login-note">
        Mock accounts are unavailable. Check that the local API and seed data are running.
      </p>
    </section>
  </main>
</template>
