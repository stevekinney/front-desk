import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.PORT ?? '4100';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
});
