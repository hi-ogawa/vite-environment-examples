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

export function vitePluginWorkerd(pluginOptions: WorkerdPluginOptions): Plugin {
  return {
    name: vitePluginWorkerd.name,
    async config(_config, _env) {
      return {
        environments: {
          workerd: {
            dev: {
              async createEnvironment(server, name) {
                const manager = await setupMiniflareManager(
                  server,
                  pluginOptions,
                );
                return new WorkerdDevEnvironment(server, name, manager);
              },
            },
          },
        },
      };
    },

    configureServer(server) {
      return () => {
        // TODO: allow interface merging for custom environment to provide a typing?
        const devEnv = server.environments["workerd"];
        tinyassert(devEnv instanceof WorkerdDevEnvironment);

        server.middlewares.use(
          createMiddleware((ctx) => devEnv.api.fetch(ctx.request), {
            alwaysCallNext: false,
          }),
        );
      };
    },
  };
}

class WorkerdDevEnvironment extends DevEnvironment {
  constructor(
    server: ViteDevServer,
    name: string,
    public manager: MiniflareManager,
  ) {
    super(server, name, {
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
          manager.webSocket.send(JSON.stringify(payload));
        },
        // TODO: for custom event e.g. vite:invalidate
        on() {},
        off() {},
      },
    });
  }

  override async close() {
    await super.close();
    await this.manager.miniflare.dispose();
  }

  get api() {
    return {
      fetch: this.manager.dispatchFetch,
    };
  }
}

type MiniflareManager = Awaited<ReturnType<typeof setupMiniflareManager>>;

async function setupMiniflareManager(
  server: ViteDevServer,
  options: WorkerdPluginOptions,
) {
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
        const devEnv = server.environments["workerd"];
        tinyassert(devEnv);
        const args = await request.json();
        const result = await devEnv.fetchModule(...(args as [any, any]));
        return new MiniflareResponse(JSON.stringify(result));
      },
    },
    bindings: {
      __viteRoot: server.config.root,
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

  return { miniflare, webSocket, dispatchFetch };
}
