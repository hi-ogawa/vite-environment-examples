import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import react from "@vitejs/plugin-react";
import { Log } from "miniflare";
import { defineConfig } from "vite";
import { vitePluginVirtualIndexHtml } from "./vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginWorkerd({
      entry: "/src/adapters/workerd.ts",
      miniflare: {
        log: new Log(),
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
}));
