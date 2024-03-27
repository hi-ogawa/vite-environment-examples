import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
} from "vite";
import { createDebug, tinyassert } from "@hiogawa/utils";
import { __global } from "./src/global";
// import react from "@vitejs/plugin-react";
import { vitePluginSsrMiddleware } from "../react-ssr/vite.config";

const debug = createDebug("app");

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    // TODO: only for client
    // react(),
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
        // [feedback] noExternal?
        // [feedback] optimizeDeps not kicking in for custom environment?
        resolve: {
          mainFields: [],
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
    async configureServer(server) {
      const reactServerEnv = server.environments["react-server"];
      tinyassert(reactServerEnv);
      debug(
        "[reactServerEnv]",
        reactServerEnv.config,
        reactServerEnv.config.dev?.optimizeDeps,
      );
      const reactServerRunner = createServerModuleRunner(reactServerEnv);
      __global.server = server;
      __global.reactServerRunner = reactServerRunner;
      return async () => {
        debug(
          "[transformRequest]",
          await reactServerEnv.transformRequest("/src/entry-react-server"),
        );
      };
    },
  };

  return [plugin];
}
