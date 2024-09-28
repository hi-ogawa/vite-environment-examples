import type { FetchFunction, Plugin } from "vite";

export function vitePluginFetchModuleServer(): Plugin {
  return {
    name: vitePluginFetchModuleServer.name,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "https://any.local");
        if (url.pathname === "/@vite/fetchModule") {
          const [name, ...args] = JSON.parse(url.searchParams.get("payload")!);
          const result = await server.environments[name]!.fetchModule(
            ...(args as Parameters<FetchFunction>),
          );
          res.end(JSON.stringify(result));
          return;
        }
        next();
      });
    },
  };
}
