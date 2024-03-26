import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  Connect,
} from "vite";
import { tinyassert } from "@hiogawa/utils";

export default defineConfig(() => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
    }),
  ],
  environments: {
    node: {
      dev: {
        // TODO(doc): createEnvironment: createNodeEnvironment
        createEnvironment: (server) => createNodeEnvironment(server, "node"),
      },
    },
  },
}));

// createServerModuleRunner port of
// https://github.com/hi-ogawa/vite-plugins/tree/992368d0c2f23dbb6c2d8c67a7ce0546d610a671/packages/vite-plugin-ssr-middleware
export function vitePluginSsrMiddleware({
  entry,
}: {
  entry: string;
}): PluginOption {
  const plugin: Plugin = {
    name: vitePluginSsrMiddleware.name,
    configureServer(server) {
      const node = server.environments["node"];
      tinyassert(node);
      const runner = createServerModuleRunner(node);
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
  };
  return [plugin];
}
