import { defineConfig } from 'vitest/config'

// Dedicated test config. The app's vite.config.ts wires the TanStack Start +
// Nitro SSR plugins, which externalize react/react-dom for the server build
// and leave component tests with two React instances (null hook dispatcher).
// Tests only need a single deduped React (esbuild handles the JSX transform
// via tsconfig's `jsx: react-jsx`). Node is the default environment;
// component/hook tests opt into jsdom with a `// @vitest-environment jsdom`
// file pragma.
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
