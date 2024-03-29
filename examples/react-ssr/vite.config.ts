import {
  defineConfig,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  Connect,
} from "vite";
import { createDebug, typedBoolean } from "@hiogawa/utils";
import { __global } from "./src/global";
import react from "@vitejs/plugin-react";
import type { ModuleRunner } from "vite/module-runner";

const debug = createDebug("app");

export default defineConfig((env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: "./dist/server/index.js",
    }),
    {
      name: "global-server",
      configureServer(server) {
        __global.server = server;
      },
    },
  ],
  environments: {
    client: {
      build: {
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    ssr: {
      build: {
        outDir: "dist/server",
        // [feedback]
        // is this still meant to be used?
        // for example, `ssr: true` seems to make `minify: false` automatically
        // and also externalization.
        ssr: true,
        rollupOptions: {
          input: {
            index: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
          },
        },
      },
    },
  },

  // [feedback] should preview automatically pick up environments.client.build.outDir?
  build: env.isPreview ? { outDir: "dist/client" } : {},

  builder: {
    async buildEnvironments(builder, build) {
      await build(builder.environments["client"]!);
      await build(builder.environments["ssr"]!);
    },
  },
}));

// createServerModuleRunner port of
// https://github.com/hi-ogawa/vite-plugins/tree/992368d0c2f23dbb6c2d8c67a7ce0546d610a671/packages/vite-plugin-ssr-middleware
// TODO: maybe whole `environments.server.dev/build` config can be moved to here
export function vitePluginSsrMiddleware({
  entry,
  preview,
}: {
  entry: string;
  preview?: string;
}): PluginOption {
  let runner: ModuleRunner;

  const plugin: Plugin = {
    name: vitePluginSsrMiddleware.name,

    // [feedback] "server" environment full-reload still triggers "client" full-reload?
    // [feedback] (doc) `ctx.environment` instead of `this.environment`
    hotUpdate(ctx) {
      if (ctx.environment.name === "ssr") {
        // [feedback] can we access runner side `moduleCache`?
        //            probably not since runner is not in the main process?
        const ids = ctx.modules.map((mod) => mod.id).filter(typedBoolean);
        const invalidated = runner.moduleCache.invalidateDepTree(ids);
        debug("[handleUpdate]", { ids, invalidated: [...invalidated] });
        return [];
      }
      return ctx.modules;
    },

    configureServer(server) {
      runner = createServerModuleRunner(server.environments.ssr);

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
