import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2019",
  external: ["react", "react-dom"],
  treeshake: true,
  minify: false,
  loader: {
    ".css": "copy"
  },
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";'
    };
  }
});
