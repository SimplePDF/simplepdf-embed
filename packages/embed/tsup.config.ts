import { defineConfig } from 'tsup'

// Multi-entry ESM build with per-entry .d.ts. Peer deps are externalized so the
// root entry carries zero runtime dependencies and the subpaths pull only the
// peer they need. Code shared across entries (the bridge, generated contract) is
// split into shared chunks rather than duplicated.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    protocol: 'src/protocol.ts',
    schemas: 'src/schemas.ts',
    tools: 'src/tools.ts',
    'ai-sdk': 'src/ai-sdk.ts',
    react: 'src/react.tsx',
    unwrap: 'src/unwrap.ts',
  },
  format: ['esm'],
  dts: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['ai', 'react', 'react-dom', 'react/jsx-runtime', 'zod'],
})
