import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
} from "vite";
import { createDebug, tinyassert } from "@hiogawa/utils";
import { __global } from "./src/global";
import react from "@vitejs/plugin-react";
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
  optimizeDeps: {
    force: true,
  },
  environments: {
    client: {},
    server: {
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "server"),
      },
    },
  },
}));

function vitePluginReactServer(): PluginOption {
  const plugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["react-server"] = {
        // TODO: noExternal? optimizeDeps not kicking in?
        resolve: {
          conditions: ["react-server"],
        },
        dev: {
          createEnvironment: (server) =>
            createNodeEnvironment(server, "react-server"),
          optimizeDeps: {
            include: [
              "react",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-server-dom-webpack/server.edge",
            ],
          },
        },
      };
    },
    configureServer(server) {
      const serverEnv = server.environments["server"];
      tinyassert(serverEnv);
      const reactServerRunner = createServerModuleRunner(serverEnv);
      __global.server = server;
      __global.reactServerRunner = reactServerRunner;
    },
  };

  return [plugin];
}
