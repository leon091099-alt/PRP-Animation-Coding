import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { '@revyme/runtime': path.resolve(__dirname, 'revyme-runtime.ts') } },
  server: { port: 5173, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
});
