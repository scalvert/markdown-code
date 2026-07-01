import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    minify: false,
    shims: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    minify: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/commands/*.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    minify: false,
    outDir: 'dist/commands',
  },
]);
