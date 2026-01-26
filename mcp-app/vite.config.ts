import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist/ui',
    rollupOptions: {
      input: 'mcp-app.html',
    },
  },
  server: {
    port: 5174,
  },
});
