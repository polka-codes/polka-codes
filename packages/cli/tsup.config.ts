import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    splitting: false,
    target: 'es2022',
  },
  {
    entry: {
      bin: 'src/bin.ts',
    },
    format: ['cjs'],
    splitting: false,
    target: 'es2022',
    noExternal: [/.*/],
    skipNodeModulesBundle: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
