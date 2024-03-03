import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";

import pkg from "./package.json" assert { type: "json" };

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "umd",
      name: "simplePDF",
      strict: true,
    },
  ],
  plugins: [
    typescript(),
    terser({
      format: {
        comments: false,
      },
    }),
  ],
  external: [],
};
