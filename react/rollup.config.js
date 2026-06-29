import scss from 'rollup-plugin-scss';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';

// Dual CJS + ESM (so existing require() consumers keep working — this is a non-breaking minor).
// react / react-dom / zod / the core are external (peer or dependency), resolved at the
// consumer rather than bundled in.
const isExternal = (id) =>
  id === 'react' ||
  id === 'react-dom' ||
  id === 'zod' ||
  id === '@tanstack/ai' ||
  id === '@simplepdf/embed' ||
  id.startsWith('@simplepdf/embed/');

export default {
  // Two entries mirroring the core: the zod-free root, and the opt-in agentic /ai-sdk
  // (which pulls zod). A consumer importing only the root never loads zod.
  input: { index: 'src/index.tsx', 'ai-sdk': 'src/ai-sdk.tsx', 'tanstack-ai': 'src/tanstack-ai.tsx' },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunks/[name]-[hash].cjs',
    },
    {
      dir: 'dist',
      format: 'es',
      exports: 'named',
      sourcemap: true,
      entryFileNames: '[name].esm.js',
      chunkFileNames: 'chunks/[name]-[hash].esm.js',
    },
  ],
  plugins: [
    scss({
      processor: () => postcss([autoprefixer()]),
      outputStyle: 'compressed',
      insert: true,
    }),
    typescript(),
    terser({
      format: {
        comments: false,
      },
    }),
  ],
  external: isExternal,
};
