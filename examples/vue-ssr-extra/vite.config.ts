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
      // [feedback] non runtime code resolution ends up as noExternal?
      //   RollupError: [commonjs--resolver] [plugin vite:resolve] Cannot bundle Node.js built-in "node:fs" imported from "src/features/server-action/plugin.ts". Consider disabling environments.workerd.noExternal or remove the built-in dependency.
      await build(builder.environments["workerd"]!);
    },
  },
}));
