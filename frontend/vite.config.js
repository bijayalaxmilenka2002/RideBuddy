import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // File events do not cross a Docker bind mount on Windows or macOS, so
    // hot reload needs polling there. docker-compose.yml sets this.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // ws:true is required or the chat handshake fails in development.
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
});
