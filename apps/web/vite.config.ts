import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// One config for the dev server, the production build and the Vitest tests.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* variables from the repository-root .env (the same file the API uses).
  // Only variables starting with VITE_ are exposed to browser code, and all of them are public.
  envDir: '../..',
  server: {
    host: 'localhost',
    // Must match the API's CORS_ORIGIN (http://localhost:5173). strictPort fails instead of
    // silently moving to another port that CORS would then reject.
    port: 5173,
    strictPort: true,
  },
  preview: { host: 'localhost', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
