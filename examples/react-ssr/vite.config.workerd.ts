import { defineConfig } from "vite";
import { __global } from "./src/global";
import react from "@vitejs/plugin-react";
import { vitePluginWorkerd } from "@hiogawa/vite-plugin-workerd";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginWorkerd({
      entry: "/src/adapters/workerd.ts",
    }),
  ],
  environments: {
    workerd: {
      // [feedback] how to prevent deps optimization to inject this?
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
