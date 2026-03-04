import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    // H2 guard: prevent VITE_SKIP_AUTH from leaking into production builds.
    // Only triggers during `vite build` (not dev server or vitest).
    {
      name: 'guard-skip-auth',
      apply: 'build',
      config(_, { command }) {
        if (command === 'build' && process.env.VITE_SKIP_AUTH === 'true') {
          throw new Error(
            'SECURITY: VITE_SKIP_AUTH=true must not be set during production builds. '
            + 'Remove it from your environment or .env files before running `vite build`.'
          );
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    // Hidden source maps: uploaded to error tracking but not served publicly.
    sourcemap: 'hidden',
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to the local Azure Functions host.
      // Active only during `vite dev` — production builds are unaffected.
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
        headers: {
          // Inject a dev user identity for the backend's auth middleware.
          // Read from VITE_DEV_USER_ID env var so each developer uses a unique ID.
          // Falls back to 'local-dev-user' if not set.
          'x-ms-client-principal-id': process.env.VITE_DEV_USER_ID || 'local-dev-user',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
