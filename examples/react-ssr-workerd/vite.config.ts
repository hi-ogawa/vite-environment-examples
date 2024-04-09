import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";
import { Log } from "miniflare";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginWorkerd({
      entry: "/src/adapters/workerd.ts",
      miniflare: {
        log: new Log(),
        kvNamespaces: { kv: "0".repeat(32) },
        kvPersist: ".wrangler/state/v3/kv",
      },
    }),
    vitePluginVirtualIndexHtml(),
  ],
  environments: {
    workerd: {
      // [feedback] how to prevent deps optimization to inject this? still `ssr.target: "webworker"` needed?
      //    import { createRequire } from 'module';const require = createRequire(import.meta.url);
      nodeCompatible: false,
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
  ssr: {
    target: "webworker",
  },
}));
