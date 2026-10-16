import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/health': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
