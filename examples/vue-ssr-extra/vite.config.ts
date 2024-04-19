import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";
import { vitePluginServerAction } from "./src/features/server-action/plugin";
import { Log } from "miniflare";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vue(),
    vitePluginServerAction(),
    vitePluginWorkerd({
      entry: "/src/adapters/workerd.ts",
      miniflare: {
        log: new Log(),
        kvPersist: true,
        bindings: {
          SLOW_MO: Number(process.env["SLOW_MO"] || 0),
        },
      },
      wrangler: {
        configPath: "./wrangler.toml",
      },
    }),
    vitePluginVirtualIndexHtml(),
  ],
  environments: {
    client: {
      build: {
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    workerd: {
      webCompatible: true,
      resolve: {
        noExternal: true,
      },
      dev: {
        optimizeDeps: {
          // prevent flaky outdated deps error
          noDiscovery: true,
          include: [],
        },
      },
      build: {
        outDir: "dist/server",
      },
    },
  },
  builder: {
    async buildEnvironments(builder, build) {
      await build(builder.environments["client"]!);
      await build(builder.environments["workerd"]!);
    },
  },
}));
