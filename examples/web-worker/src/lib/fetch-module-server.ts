import type { Plugin } from "vite";

export function vitePluginFetchModuleServer(): Plugin {
  return {
    name: vitePluginFetchModuleServer.name,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "https://any.local");
        if (url.pathname === "/@vite/invoke") {
          const [name, ...args] = JSON.parse(url.searchParams.get("payload")!);
          const devEnv = server.environments[name]!;
          const result = await (devEnv as any).__invoke(...args);
          res.end(JSON.stringify(result));
          return;
        }
        next();
      });
    },
  };
}
