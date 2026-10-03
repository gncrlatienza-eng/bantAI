import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // src/api/apiClient.ts falls back to http://localhost:3000/api when
  // VITE_API_URL is unset. That's right for `npm run dev`, but a deployed
  // build with the fallback calls each visitor's own machine and every page
  // fails. A production build therefore has to name the deployed backend.
  if (command === 'build' && mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL ?? '';
    if (!/^https:\/\/[^/]+\/api$/.test(apiUrl)) {
      throw new Error(
        'Set VITE_API_URL to the deployed backend, e.g. VITE_API_URL=https://api.example.com/api npm run build (see web/.env.example).',
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
