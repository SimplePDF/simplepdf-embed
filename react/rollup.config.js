import scss from 'rollup-plugin-scss';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      strict: true,
    },
    {
      file: pkg.module,
      format: 'es',
      exports: 'named',
      sourcemap: true,
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
  external: ['react', 'react-dom'],
};
