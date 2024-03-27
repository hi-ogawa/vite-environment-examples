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
import { vitePluginEnvironmentOptimizeDeps } from "../custom/src/optimize-deps/vite-plugin-environment-optimize-deps"

const debug = createDebug("app");
debug;

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
    vitePluginEnvironmentOptimizeDeps({
      name: "react-server",
    })
  ],
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
    async configureServer(server) {
      const reactServerEnv = server.environments["react-server"];
      tinyassert(reactServerEnv);
      const reactServerRunner = createServerModuleRunner(reactServerEnv);
      __global.server = server;
      __global.reactServerRunner = reactServerRunner;
    },
  };

  return [plugin];
}
