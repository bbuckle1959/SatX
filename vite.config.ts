import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/celestrak/, ''),
      },
    },
  },
  preview: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/celestrak/, ''),
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('satellite.js')) return 'satellite';
          if (id.includes('three') || id.includes('@react-three')) {
            return 'three-globe';
          }
        },
      },
    },
  },
}));
