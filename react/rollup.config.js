import scss from "rollup-plugin-scss";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import typescript from "rollup-plugin-typescript2";
import { uglify } from "rollup-plugin-uglify";

import pkg from "./package.json";

export default {
  input: "src/index.tsx",
  output: [
    {
      file: pkg.main,
      format: "cjs",
      exports: "named",
      sourcemap: true,
      strict: false,
    },
  ],
  plugins: [
    scss({
      processor: () => postcss([autoprefixer()]),
      outputStyle: "compressed",
      insert: true,
    }),
    typescript(),
    uglify(),
  ],
  external: ["react", "react-dom"],
};
