/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Preserve the portable single-file build. The Pages build uses normal assets:
// viteSingleFile's recommended config forcibly changes base to './'.
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/BeeFit/' : './',
  plugins: mode === 'pages' ? [react()] : [react(), viteSingleFile()],
  test: { globals: true, environment: 'node' },
}));
