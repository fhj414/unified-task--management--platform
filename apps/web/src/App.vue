<script setup lang="ts">
import { onMounted } from 'vue';
import { useHealthStore } from './stores/health';
import TodoPlaceholderView from './views/TodoPlaceholderView.vue';

const healthStore = useHealthStore();

onMounted(() => {
  void healthStore.loadHealth();
});
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="#main-content" aria-label="Enterprise Hub home">
        <span class="brand-mark" aria-hidden="true">EH</span>
        <span>Enterprise Hub</span>
      </a>
      <p class="header-context">Team workspace preview</p>
    </header>

    <div class="app-layout">
      <aside class="sidebar">
        <nav aria-label="Primary navigation">
          <p class="nav-label">Overview</p>
          <a class="nav-link is-current" href="#main-content" aria-current="page">Dashboard</a>
          <a class="nav-link" href="#tasks">Team tasks</a>
        </nav>

        <section class="health-card" aria-labelledby="health-heading">
          <p class="eyebrow">System health</p>
          <h2 id="health-heading">Connection status</h2>
          <p
            class="connection-status"
            :class="`is-${healthStore.state}`"
            role="status"
            aria-live="polite"
          >
            <span class="status-dot" aria-hidden="true"></span>
            {{ healthStore.connectionLabel }}
          </p>
          <dl v-if="healthStore.health" class="service-statuses">
            <div>
              <dt>API</dt>
              <dd>{{ healthStore.health.services.api }}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{{ healthStore.health.services.database }}</dd>
            </div>
            <div>
              <dt>Redis</dt>
              <dd>{{ healthStore.health.services.redis }}</dd>
            </div>
          </dl>
          <p v-else class="health-detail">
            {{ healthStore.isLoading ? 'Checking the service endpoint.' : 'Service details are unavailable.' }}
          </p>
        </section>
      </aside>

      <main id="main-content" class="main-content" tabindex="-1">
        <section class="welcome" aria-labelledby="welcome-heading">
          <p class="eyebrow">Welcome back</p>
          <h1 id="welcome-heading">Your work, in one place.</h1>
          <p>
            Enterprise Hub is being prepared for your team. Explore this preview while task management is connected.
          </p>
        </section>

        <TodoPlaceholderView />
      </main>
    </div>
  </div>
</template>
