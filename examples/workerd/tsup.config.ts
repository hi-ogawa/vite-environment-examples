import { defineConfig } from "tsup";

export default [
  defineConfig({
    outDir: "src/poc/dist",
    entry: ["src/poc/worker.ts"],
    format: ["esm"],
    platform: "browser",
    noExternal: [/.*/],
  }),
  defineConfig({
    entry: ["src/worker.ts"],
    format: ["esm"],
    platform: "browser",
    noExternal: [/.*/],
  }),
  defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    dts: true,
    external: ["vite", "miniflare"],
  }),
];
