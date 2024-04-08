import {
  Log,
  Miniflare,
  type MiniflareOptions,
  type WorkerOptions,
  Response as MiniflareResponse,
} from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert } from "@hiogawa/utils";
import { RUNNER_INIT_PATH, type RunnerEnv } from "./shared";
import { DevEnvironment, type Plugin, type ViteDevServer } from "vite";
import { createMiddleware } from "@hattip/adapter-node/native-fetch";

interface WorkerdPluginOptions {
  entry: string;
  options?: (v: MiniflareOptions & WorkerOptions) => void;
}

let globalServer: ViteDevServer;

export function vitePluginWorkerd(pluginOptions: WorkerdPluginOptions): Plugin {
  let manager: MiniflareManager | undefined;
  let dispose = async () => {
    await manager?.miniflare.dispose();
    manager = undefined;
  };

  return {
    name: vitePluginWorkerd.name,
    apply: "serve",
    async config(_config, _env) {
      dispose();

      // [feedback]
      // `createEnvironment` should be async?
      //  otherwise this complicated miniflare setup has to be done outside of `createEnvironment`
      manager = await setupMiniflareManager(pluginOptions);
      const webSocket = manager.webSocket;

      return {
        environments: {
          workerd: {
            dev: {
              createEnvironment(server, name) {
                globalServer = server;

                return new DevEnvironment(server, name, {
                  hot: {
                    name,
                    close() {},
                    listen() {},
                    // cf. createServerHMRChannel
                    send(...args: any[]) {
                      let payload: any;
                      if (typeof args[0] === "string") {
                        payload = {
                          type: "custom",
                          event: args[0],
                          data: args[1],
                        };
                      } else {
                        payload = args[0];
                      }
                      webSocket.send(JSON.stringify(payload));
                    },
                    // TODO: for custom event e.g. vite:invalidate
                    on() {},
                    off() {},
                  },
                });
              },
            },
          },
        },
      };
    },

    configureServer(server) {
      return () => {
        server.middlewares.use(
          createMiddleware(
            (ctx) => {
              tinyassert(manager);
              return manager.dispatchFetch(ctx.request);
            },
            {
              alwaysCallNext: false,
            },
          ),
        );
      };
    },

    async buildEnd() {
      await dispose();
    },
  };
}

type MiniflareManager = Awaited<ReturnType<typeof setupMiniflareManager>>;

async function setupMiniflareManager(options: WorkerdPluginOptions) {
  const RUNNER_OBJECT_BINDING = "__VITE_RUNNER";

  const miniflareOptions: MiniflareOptions = {
    log: new Log(),
    modulesRoot: "/",
    modules: [
      {
        type: "ESModule",
        path: fileURLToPath(new URL("./worker.js", import.meta.url)),
      },
    ],
    durableObjects: {
      [RUNNER_OBJECT_BINDING]: "RunnerObject",
    },
    unsafeEvalBinding: "__viteUnsafeEval",
    serviceBindings: {
      __viteFetchModule: async (request) => {
        const devEnv = globalServer.environments["workerd"];
        tinyassert(devEnv);
        const args = await request.json();
        const result = await devEnv.fetchModule(...(args as [any, any]));
        return new MiniflareResponse(JSON.stringify(result));
      },
    },
    bindings: {
      // TODO: server.config.root
      __viteRoot: process.cwd(),
      __viteEntry: options.entry,
    } satisfies Omit<RunnerEnv, "__viteUnsafeEval" | "__viteFetchModule">,
  };
  options.options?.(miniflareOptions);

  const miniflare = new Miniflare(miniflareOptions);

  const ns = await miniflare.getDurableObjectNamespace(RUNNER_OBJECT_BINDING);
  const runnerObject = ns.get(ns.idFromName(""));

  const res = await runnerObject.fetch("http://any.local" + RUNNER_INIT_PATH, {
    headers: {
      Upgrade: "websocket",
    },
  });
  tinyassert(res.webSocket);
  const { webSocket } = res;
  webSocket.accept();

  async function dispatchFetch(request: Request) {
    const response = await runnerObject.fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body as any,
      duplex: "half",
      redirect: "manual",
    });
    return response as any as Response;
  }

  return { miniflare, runnerObject, webSocket, dispatchFetch };
}
