import typescript from "rollup-plugin-typescript2";

import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "es",
      strict: true,
    },
  ],
  plugins: [typescript()],
  external: [],
};
