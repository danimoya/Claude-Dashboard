import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 3000;
const BACKEND_HTTP = process.env.BACKEND_TARGET || 'http://localhost:5000';
const BACKEND_WS = BACKEND_HTTP.replace(/^http/, 'ws');
const ALLOWED_HOSTS = (process.env.FRONTEND_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    allowedHosts: ALLOWED_HOSTS.length > 0 ? ALLOWED_HOSTS : true,
    proxy: {
      '/api': { target: BACKEND_HTTP, changeOrigin: true },
      '/ws': { target: BACKEND_WS, ws: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          editor: ['monaco-editor', '@monaco-editor/react'],
          terminal: ['xterm', 'xterm-addon-fit'],
          charts: ['recharts'],
        },
      },
    },
  },
});
