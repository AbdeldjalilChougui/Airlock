import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Chrome extension build: side panel page + MV3 service worker, same React code as the web app.
export default defineConfig({
  plugins: [react()],
  base: '',
  publicDir: 'extension',
  build: {
    outDir: 'dist-ext',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'ext/sidepanel.html'),
        background: resolve(__dirname, 'src/ext/background.ts'),
      },
      output: {
        entryFileNames: (c) => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
