/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Keep the portable build; the single-file plugin overrides base, so omit it for Pages.
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/BeeFit/' : './',
  plugins: mode === 'pages' ? [react()] : [react(), viteSingleFile()],
  test: { globals: true, environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
}));
