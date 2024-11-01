import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import vue from "@vitejs/plugin-vue";
import { Log } from "miniflare";
import { defineConfig } from "vite";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vue(),
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
      resolve: {
        noExternal: true,
      },
    },
  },
}));
