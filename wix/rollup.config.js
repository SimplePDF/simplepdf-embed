import typescript from "rollup-plugin-typescript2";
import serve from "rollup-plugin-serve";

import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
      strict: true,
    },
  ],
  plugins: [typescript(), serve('dist')],
  external: [],
};
