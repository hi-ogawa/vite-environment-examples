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
            // [feedback]: esm also needs to be optimized? otherwise I get a following error:
            //   Error: Vite Internal Error: registerMissingImport is not supported in dev workerd
            //   at Object.registerMissingImport (file:///home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.1_@types+node@20.11.30/node_modules/vite/dist/node/chunks/dep-gq9_cnPm.js:57557:19)
            "seroval",
            "seroval-plugins/web",
          ],
        },
      },
    },
  },
  ssr: {
    target: "webworker",
  },
}));
