import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { vitePluginFetchModuleServer } from "../web-worker/src/lib/fetch-module-server";
import { vitePluginWorkerEnvironment } from "../web-worker/vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [
    react(),
    vitePluginWorkerEnvironment(),
    vitePluginFetchModuleServer(),
  ],
  environments: {
    client: {
      optimizeDeps: {
        exclude: ["vite/module-runner"],
      },
    },
    worker: {
      keepProcessEnv: false,
      resolve: {
        // need "browser" condition for "react-server-dom-webpack/server"
        conditions: ["module", "worker", "browser", "react-server"],
        noExternal: true,
      },
      optimizeDeps: {
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-server-dom-webpack/server",
        ],
        esbuildOptions: {
          platform: "browser",
          banner: undefined,
        },
      },
    },
  },
}));
