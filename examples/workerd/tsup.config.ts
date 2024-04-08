import { defineConfig } from "tsup";

export default [
  defineConfig({
    outDir: "src/poc/dist",
    entry: ["src/poc/worker.ts"],
    format: ["esm"],
    platform: "browser",
    noExternal: [/.*/],
  }),
];
