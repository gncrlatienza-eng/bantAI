import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // src/api/apiClient.ts falls back to http://localhost:3000/api when
  // VITE_API_URL is unset. That's right for `npm run dev`, but a deployed
  // build with the fallback calls each visitor's own machine and every page
  // fails. A production build must name the HTTPS backend, or use the
  // exact /api path when the hosting server proxies it to that backend.
  if (command === 'build' && mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL ?? '';
    if (apiUrl !== '/api' && !/^https:\/\/[^/]+\/api$/.test(apiUrl)) {
      throw new Error(
        'Set VITE_API_URL to the HTTPS backend ending in /api, or /api with a same-origin backend proxy (see web/.env.example).',
      );
    }
  }
  return config;
});

const config = {
  plugins: [react()],
  server: {
    // Bind IPv4 as well as localhost so the Codex browser and LAN test devices
    // do not fail when Windows resolves localhost to IPv6 only.
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
};
