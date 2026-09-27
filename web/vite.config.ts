import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const target = process.env.VITE_APP_TARGET || mode;

  let input: Record<string, string> = {
    public: resolve(__dirname, 'index.html'),
    client: resolve(__dirname, 'client.html'),
    admin: resolve(__dirname, 'admin.html'),
  };

  let outDir = 'dist';

  if (target === 'client') {
    input = {
      client: resolve(__dirname, 'client.html'),
    };
    outDir = 'dist/client';
  } else if (target === 'admin') {
    input = {
      admin: resolve(__dirname, 'admin.html'),
    };
    outDir = 'dist/admin';
  } else if (target === 'public') {
    input = {
      public: resolve(__dirname, 'index.html'),
    };
    outDir = 'dist/public';
  }

  return {
    plugins: [react()],
    build: {
      outDir,
      rollupOptions: {
        input,
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
