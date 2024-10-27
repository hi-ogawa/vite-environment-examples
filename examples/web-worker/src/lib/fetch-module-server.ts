import { DevEnvironment, type DevEnvironmentOptions, type Plugin } from "vite";

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

// expose `DevEnvironment.__invoke`
export const createEnvironmentWithInvoke: NonNullable<
  DevEnvironmentOptions["createEnvironment"]
> = (name, config) => {
  let invokeHandler!: Function;
  const devEnv = new DevEnvironment(name, config, {
    hot: false,
    transport: {
      setInvokeHandler(invokeHandler_) {
        if (invokeHandler_) {
          invokeHandler = invokeHandler_;
        }
      },
    },
  });
  Object.assign(devEnv, { __invoke: invokeHandler });
  return devEnv;
};
