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
        compatibilityDate: "2024-01-01",
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
          include: [],
        },
      },
    },
  },
}));
