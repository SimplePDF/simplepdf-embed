import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";

import pkg from "./package.json" assert { type: "json" };

function createOutputConfig({ file, minify }) {
  return {
    file,
    format: "umd",
    name: "simplePDF",
    strict: true,
    plugins: minify ? [terser({ format: { comments: false } })] : [],
  };
}

export default {
  input: "src/index.ts",
  output: [
    createOutputConfig({ file: pkg.main, minify: false }),
    createOutputConfig({
      file: pkg.main.replace(".js", ".min.js"),
      minify: true,
    }),
  ],
  plugins: [typescript()],
  external: [],
};
