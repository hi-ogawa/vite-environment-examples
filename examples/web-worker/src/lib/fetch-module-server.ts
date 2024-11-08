import { type Plugin } from "vite";

export function vitePluginFetchModuleServer(): Plugin {
  return {
    name: vitePluginFetchModuleServer.name,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "https://any.local");
        if (url.pathname === "/@vite/invoke") {
          const [name, payload] = JSON.parse(url.searchParams.get("data")!);
          const devEnv = server.environments[name]!;
          const result = await devEnv.hot.handleInvoke(payload);
          res.end(JSON.stringify(result));
          return;
        }
        next();
      });
    },
  };
}
