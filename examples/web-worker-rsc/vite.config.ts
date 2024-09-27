import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { vitePluginWorkerRunner } from "../web-worker/vite.config";
import { vitePluginFetchModuleServer } from "./src/lib/fetch-module-server";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [react(), vitePluginWorkerRunner(), vitePluginFetchModuleServer()],
  environments: {
    client: {
      dev: {
        optimizeDeps: {
          exclude: ["vite/module-runner"],
        },
      },
    },
    worker: {
      webCompatible: true,
      resolve: {
        conditions: [
          // "react-server",
          "worker",
        ],
        noExternal: true,
      },
      dev: {
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/server",
          ],
        },
      },
    },
  },
}));
