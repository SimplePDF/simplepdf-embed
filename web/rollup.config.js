import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import pkg from './package.json' with { type: 'json' };

function createOutputConfig({ file, minify }) {
  return {
    file,
    format: 'umd',
    inlineDynamicImports: true,
    name: 'simplePDF',
    strict: true,
    plugins: minify ? [terser({ format: { comments: false } })] : [],
  };
}

export default {
  input: 'src/index.ts',
  output: [
    createOutputConfig({ file: pkg.main, minify: false }),
    createOutputConfig({
      file: pkg.main.replace('.js', '.min.js'),
      minify: true,
    }),
  ],
  plugins: [nodeResolve({ browser: true }), typescript()],
  external: [],
};
