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
      webCompatible: true,
      resolve: {
        conditions: ["react-server"],
        noExternal: true,
      },
      optimizeDeps: {
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-server-dom-webpack/server",
        ],
      },
    },
  },
}));
