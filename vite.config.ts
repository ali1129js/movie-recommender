/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so assets need that base.
// Override with VITE_BASE (e.g. VITE_BASE=/ npm run build) for a root-hosted deployment.
export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/movie-recommender/',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
  },
});
