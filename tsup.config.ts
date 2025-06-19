import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  minify: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
}); 