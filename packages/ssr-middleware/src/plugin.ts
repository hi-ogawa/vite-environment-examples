import {
  Connect,
  type Plugin,
  type PluginOption,
  createServerModuleRunner,
} from "vite";

export function vitePluginSsrMiddleware({
  entry,
  preview,
  hmr,
}: {
  entry: string;
  preview?: string;
  hmr?: false;
}): PluginOption {
  const plugin: Plugin = {
    name: vitePluginSsrMiddleware.name,

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

    configureServer(server) {
      const runner = createServerModuleRunner(
        server.environments.ssr,
        hmr === false ? { hmr: false } : undefined,
      );

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
