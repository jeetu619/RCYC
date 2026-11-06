import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The API may fall back to another port when 3000 is busy; set API_PORT to match.
const apiPort = process.env.API_PORT || '3000';

export default defineConfig({
  root: path.resolve(__dirname, 'src/frontend'),
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/frontend'),
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
