import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_API_URL || 'https://live-polling-app-rose.vercel.app';

const proxyConfig = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    ws: true,
    configure: (proxy, options) => {
      proxy.on('error', (err, req, res) => {
        console.error('[Vite Proxy Error]', err.message);
        if (res && !res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Backend connection error: ${err.message}` }));
        }
      });
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 5174,
    host: true,
    proxy: proxyConfig,
  },
});
