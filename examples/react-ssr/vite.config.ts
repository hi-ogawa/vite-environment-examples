import {
  defineConfig,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  Connect,
  type ViteDevServer,
} from "vite";
import { createDebug, typedBoolean } from "@hiogawa/utils";
import react from "@vitejs/plugin-react";
import type { ModuleRunner } from "vite/module-runner";
import fs from "node:fs";

const debug = createDebug("app");

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: "./dist/server/index.js",
    }),
    vitePluginVirtualIndexHtml(),
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
      },
    },
  },

  builder: {
    async buildEnvironments(builder, build) {
      await build(builder.environments["client"]!);
      await build(builder.environments["ssr"]!);
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
  let runner: ModuleRunner;

  const plugin: Plugin = {
    name: vitePluginSsrMiddleware.name,

    config(config, env) {
      // [feedback] to be fixed by https://github.com/vitejs/vite/pull/16301
      if (env.isPreview) {
        return {
          build: {
            outDir: config.environments?.["client"]?.build?.outDir,
          },
        };
      }
      return;
    },

    configEnvironment(name, _config, _env) {
      if (name === "ssr") {
        return {
          build: {
            // [feedback] should `ssr: true` be automatically set?
            ssr: true,
            rollupOptions: {
              input: {
                index: entry,
              },
            },
          },
        };
      }
      return;
    },

    // [feedback] "server" environment full-reload still triggers "client" full-reload?
    hotUpdate(ctx) {
      if (ctx.environment.name === "ssr") {
        const ids = ctx.modules.map((mod) => mod.id).filter(typedBoolean);
        if (ids.length > 0) {
          const invalidated = runner.moduleCache.invalidateDepTree(ids);
          console.log("[ssr:invalidate]", ctx.file);
          debug("[ssr:handleUpdate]", { ids, invalidated: [...invalidated] });
          return [];
        }
      }
      return;
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

export function vitePluginVirtualIndexHtml(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: vitePluginVirtualIndexHtml.name,
    configureServer(server_) {
      server = server_;
    },
    resolveId(source, _importer, _options) {
      return source === "virtual:index.html" ? "\0" + source : undefined;
    },
    async load(id, _options) {
      if (id === "\0" + "virtual:index.html") {
        let html: string;
        if (server) {
          this.addWatchFile("index.html");
          html = await fs.promises.readFile("index.html", "utf-8");
          html = await server.transformIndexHtml("/", html);
        } else {
          html = await fs.promises.readFile("dist/client/index.html", "utf-8");
        }
        return `export default ${JSON.stringify(html)}`;
      }
      return;
    },
  };
}
