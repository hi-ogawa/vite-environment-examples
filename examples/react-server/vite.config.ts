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
import { vitePluginEnvironmentOptimizeDeps } from "./vite-plugin-environment-optimize-deps";

const debug = createDebug("app");

export default defineConfig((env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    // TODO: only for client
    // react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: new URL("./dist/server/index.js", import.meta.url).toString(),
    }),
    vitePluginReactServer(),
    vitePluginEnvironmentOptimizeDeps({
      name: "react-server",
    }),
  ],

  // [feedback] same as react-ssr
  define:
    env.command === "build"
      ? {
          "process.env.NODE_ENV": `"production"`,
        }
      : {},

  environments: {
    client: {
      build: {
        outDir: "dist/client",
        minify: false,
        sourcemap: true,
      },
    },
    server: {
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "server"),
      },
      build: {
        outDir: "dist/server",
        minify: false,
        sourcemap: true,
        ssr: true, // [feedback] what does this affect?
        modulePreload: false, // [feedback] how to remove __vitePreload?
        rollupOptions: {
          input: {
            index: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
          },
          external: (source) => {
            return source[0] !== "/" && source[0] !== ".";
          },
        },
      },
    },
  },

  // [feedback] same as react-ssr
  build: env.isPreview ? { outDir: "dist/client" } : {},

  builder: {
    runBuildTasks: async (_builder, buildTasks) => {
      for (const task of buildTasks) {
        // [feedback] same as react-ssr
        Object.assign(
          task.config.build,
          task.config.environments[task.environment.name]?.build,
        );
        // [feedback] resolve not working?
        debug("[build:config.resolve]", [
          task.environment.name,
          task.config.resolve,
        ]);
        Object.assign(
          task.config.resolve,
          task.config.environments[task.environment.name]?.resolve,
        );
      }

      debug(
        "[build]",
        buildTasks.map((t) => t.environment.name),
      );

      // [feedback] `buildTasks` should be object?
      const tasks = Object.fromEntries(
        buildTasks.map((t) => [t.environment.name, t]),
      );
      await tasks["react-server"].run();
      await tasks["client"].run();
      await tasks["server"].run();
    },
  },
}));

function vitePluginReactServer(): PluginOption {
  const plugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["react-server"] = {
        // [feedback] not working during build?
        resolve: {
          conditions: ["react-server"],
          alias: {
            react: "",
          },
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
        build: {
          outDir: "dist/react-server",
          minify: false,
          sourcemap: true,
          ssr: true,
          rollupOptions: {
            input: {
              index: "/src/entry-react-server",
            },
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
