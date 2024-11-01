import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { vitePluginWorkerEnvironment } from "../web-worker/vite.config";
import { vitePluginFetchModuleServer } from "./src/lib/fetch-module-server";

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
        conditions: ["module", "react-server"],
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
