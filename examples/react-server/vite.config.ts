import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  Connect,
} from "vite";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { __global } from "./src/global";
import react from "@vitejs/plugin-react";
import type { ModuleRunner } from "vite/module-runner";
import { vitePluginSsrMiddleware } from "../react-ssr/vite.config";

const debug = createDebug("app");
debug;

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
    }),
    vitePluginReactServer(),
  ],
  environments: {
    client: {
      build: {
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    server: {
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "server"),
      },
    },
    reactServer: {
      dev: {
        createEnvironment: (server) =>
          createNodeEnvironment(server, "reactServer"),
      },
    },
  },
}));

function vitePluginReactServer(): PluginOption {
  const plugin: Plugin = {
    name: vitePluginReactServer.name,
    configureServer(server) {
      __global.server = server;
    },
  }

  return [plugin];
}
