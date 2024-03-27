import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  Connect,
} from "vite";
import { tinyassert } from "@hiogawa/utils";
import { __global } from "./src/global";

// [feedback]
// - cac cli error?
//   vite build --environment=client

export default defineConfig((env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: "./dist/server/index.js",
    }),
  ],
  // [feedback] no automatic process.env.NODE_ENV replacement applied for build?
  define:
    env.command === "build"
      ? {
          "process.env.NODE_ENV": `"production"`,
        }
      : {},
  // [feedback] array or record?
  environments: {
    client: {
      // [feedback] not working? (see runBuildTasks below)
      build: {
        // minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    // [feedback] cannot use "ssr" as it conflicts with builtin one?
    server: {
      dev: {
        // [feedback] type error? createEnvironment: createNodeEnvironment
        createEnvironment: (server) => createNodeEnvironment(server, "server"),
      },
      // [feedback] can we reuse vite's default ssr build config e.g. external, minify?
      build: {
        minify: false,
        outDir: "dist/server",
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

  // [feedback] should preview automatically pick up environments.client.build.outDir?
  build: env.isPreview ? { outDir: "dist/client" } : {},

  builder: {
    runBuildTasks: async (_builder, buildTasks) => {
      for (const task of buildTasks) {
        // [feedback] task config empty?
        // console.log("[task.environment.config]", task.environment.config);
        Object.assign(
          task.config.build,
          // for now, we can grab the same config by this
          task.config.environments[task.environment.name]?.build,
        );
        await task.run();
      }
    },
  },
}));

// createServerModuleRunner port of
// https://github.com/hi-ogawa/vite-plugins/tree/992368d0c2f23dbb6c2d8c67a7ce0546d610a671/packages/vite-plugin-ssr-middleware
export function vitePluginSsrMiddleware({
  entry,
  preview,
}: {
  entry: string;
  preview?: string;
}): PluginOption {
  const plugin: Plugin = {
    name: vitePluginSsrMiddleware.name,

    configureServer(server) {
      __global.server = server;

      const serverEnv = server.environments["server"];
      tinyassert(serverEnv);
      const runner = createServerModuleRunner(serverEnv);
      const handler: Connect.NextHandleFunction = async (req, res, next) => {
        try {
          const mod = await runner.import(entry);
          await mod["default"](req, res, next);
        } catch (e) {
          next(e);
        }
      };
      return () => server.middlewares.use(handler);
    },

    async configurePreviewServer(server) {
      if (preview) {
        const mod = await import(preview);
        return () => server.middlewares.use(mod.default);
      }
      return;
    },
  };
  return [plugin];
}
