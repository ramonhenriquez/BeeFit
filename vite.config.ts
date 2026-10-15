/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// viteSingleFile inlines all JS/CSS into dist/index.html so the app
// can be opened as one self-contained file (or hosted anywhere static).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: { globals: true, environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
