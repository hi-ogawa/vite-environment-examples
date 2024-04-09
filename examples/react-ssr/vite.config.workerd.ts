import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";
import { vitePluginVirtualIndexHtml } from "./vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginWorkerd({
      entry: "/src/adapters/workerd.ts",
      // miniflare: {
      //   kvNamespaces: [],
      // },
      // wrangler: {
      //   configPath: "./wrangler.toml",
      // },
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
