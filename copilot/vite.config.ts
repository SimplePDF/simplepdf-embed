import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart({
      // Co-located *.test.ts / *.spec.ts files under src/routes are tests, not
      // routes; skip them so the generator stops warning "does not export a Route".
      router: { routeFileIgnorePattern: '\\.(test|spec)\\.' },
    }),
    viteReact(),
  ],
})

export default config
