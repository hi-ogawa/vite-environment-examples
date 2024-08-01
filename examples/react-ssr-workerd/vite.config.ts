import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import react from "@vitejs/plugin-react";
import { Log } from "miniflare";
import { defineConfig } from "vite";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginLogger(),
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
        outDir: "dist/client",
      },
    },
    workerd: {
      webCompatible: true,
      resolve: {
        noExternal: true,
        external: ["node:util"],
      },
      dev: {
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/server.edge",
          ],
        },
      },
      build: {
        ssr: true,
        outDir: "dist/server",
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
