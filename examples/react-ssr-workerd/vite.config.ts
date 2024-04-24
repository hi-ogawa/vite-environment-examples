import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";
import { Log } from "miniflare";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";

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
    workerd: {
      webCompatible: true,
      resolve: {
        noExternal: true,
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
    },
  },
}));
