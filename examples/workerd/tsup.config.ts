import { defineConfig } from "tsup";

export default [
  defineConfig({
    outDir: "src/example4/dist",
    entry: ["src/example4/worker.ts"],
    format: ["esm"],
    platform: "browser",
    noExternal: [/.*/],
  }),
];
