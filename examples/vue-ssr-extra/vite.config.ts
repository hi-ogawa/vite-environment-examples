import { mkdirSync } from "node:fs";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import vue from "@vitejs/plugin-vue";
import { Log } from "miniflare";
import { defineConfig } from "vite";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";
import { vitePluginServerAction } from "./src/features/server-action/plugin";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vue(),
    vitePluginServerAction(),
    vitePluginLogger(),
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
    {
      // ensure wrangler.toml assets.directory exists
      name: "ensure-wrangler-assets-directory",
      enforce: "pre",
      config() {
        mkdirSync("dist/client", { recursive: true });
      },
    },
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
      resolve: {
        noExternal: true,
        conditions: ["module", "browser", "production/development"],
      },
      build: {
        outDir: "dist/server",
        rollupOptions: {
          output: {
            // TODO: broken without this. probably my app setup issue.
            inlineDynamicImports: true,
          },
        },
      },
    },
  },
  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments["client"]!);
      await builder.build(builder.environments["workerd"]!);
    },
  },
}));
