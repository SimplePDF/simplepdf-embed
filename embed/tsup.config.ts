import { defineConfig } from 'tsup'

// Multi-entry dual ESM + CJS build with per-entry .d.ts. CJS is kept so consumers
// that `require()` (incl. @simplepdf/react-embed-pdf's own CJS bundle, which keeps
// this core external) still resolve. Peer deps are externalized so the root entry
// carries zero runtime dependencies and the subpaths pull only the peer they need.
// Code shared across entries (the bridge, generated contract) is split into shared
// chunks rather than duplicated.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    protocol: 'src/protocol.ts',
    schemas: 'src/schemas.ts',
    tools: 'src/tools.ts',
    'ai-sdk': 'src/ai-sdk.ts',
    'tanstack-ai': 'src/tanstack-ai.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['zod', '@tanstack/ai'],
})
