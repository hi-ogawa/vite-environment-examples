import {
  Log,
  Miniflare,
  type WorkerOptions,
  Request as MiniflareRequest,
  Response as MiniflareResponse,
  mergeWorkerOptions,
} from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert } from "@hiogawa/utils";
import { ANY_URL, RUNNER_INIT_PATH, setRunnerFetchOptions } from "./shared";
import {
  DevEnvironment,
  type HMRChannel,
  type Plugin,
  type ViteDevServer,
} from "vite";
import { createMiddleware } from "@hattip/adapter-node/native-fetch";
import type { SourcelessWorkerOptions } from "wrangler";

interface WorkerdPluginOptions extends WorkerdEnvironmentOptions {
  entry: string;
}

interface WorkerdEnvironmentOptions {
  miniflare?: SourcelessWorkerOptions;
  wrangler?: {
    configPath?: string;
  };
}

export function vitePluginWorkerd(pluginOptions: WorkerdPluginOptions): Plugin {
  return {
    name: vitePluginWorkerd.name,
    async config(_config, _env) {
      return {
        environments: {
          workerd: {
            dev: {
              createEnvironment: (server, name) =>
                createWorkerdDevEnvironment(server, name, pluginOptions),
            },
          },
        },
      };
    },

    configureServer(server) {
      return async () => {
        const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;
        server.middlewares.use(
          createMiddleware(
            (ctx) => devEnv.api.dispatchFetch(pluginOptions.entry, ctx.request),
            {
              alwaysCallNext: false,
            },
          ),
        );
      };
    },
  };
}

export type WorkerdDevEnvironment = Awaited<
  ReturnType<typeof createWorkerdDevEnvironment>
>;

export async function createWorkerdDevEnvironment(
  server: ViteDevServer,
  name: string,
  pluginOptions: WorkerdEnvironmentOptions,
) {
  // setup miniflare with a durable object script to run vite module runner
  let runnerWorkerOptions: WorkerOptions = {
    modulesRoot: "/",
    modules: [
      {
        type: "ESModule",
        path: fileURLToPath(new URL("./worker.js", import.meta.url)),
      },
    ],
    durableObjects: {
      __viteRunner: "RunnerObject",
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
    },
  };

  // https://github.com/cloudflare/workers-sdk/blob/2789f26a87c769fc6177b0bdc79a839a15f4ced1/packages/vitest-pool-workers/src/pool/config.ts#L174-L195
  if (pluginOptions.wrangler?.configPath) {
    const wrangler = await import("wrangler");
    const wranglerOptions = wrangler.unstable_getMiniflareWorkerOptions(
      pluginOptions.wrangler.configPath,
    );
    runnerWorkerOptions = mergeWorkerOptions(
      wranglerOptions.workerOptions,
      runnerWorkerOptions,
    ) as WorkerOptions;
  }

  if (pluginOptions.miniflare) {
    runnerWorkerOptions = mergeWorkerOptions(
      pluginOptions.miniflare,
      runnerWorkerOptions,
    ) as WorkerOptions;
  }

  const miniflare = new Miniflare({
    log: new Log(),
    workers: [runnerWorkerOptions],
  });

  // get durable object singleton
  const ns = await miniflare.getDurableObjectNamespace("__viteRunner");
  const runnerObject = ns.get(ns.idFromName(""));

  // initial request to setup websocket
  const initResponse = await runnerObject.fetch(ANY_URL + RUNNER_INIT_PATH, {
    headers: {
      Upgrade: "websocket",
    },
  });
  tinyassert(initResponse.webSocket);
  const { webSocket } = initResponse;
  webSocket.accept();

  // vite environment hot
  const hot: HMRChannel = {
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
  };

  // inheritance to extend dispose
  class WorkerdDevEnvironment extends DevEnvironment {
    override async close() {
      await super.close();
      await miniflare.dispose();
    }
  }

  const devEnv = new WorkerdDevEnvironment(server, name, { hot });

  // custom environment api
  const api = {
    async dispatchFetch(entry: string, request: Request) {
      const req = new MiniflareRequest(request.url, {
        method: request.method,
        headers: setRunnerFetchOptions(new Headers(request.headers), {
          entry,
        }),
        body: request.body as any,
        duplex: "half",
        redirect: "manual",
      });
      const res = await runnerObject.fetch(req);
      return new Response(res.body as any, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers as any,
      });
    },
  };

  // workaround for tsup dts?
  Object.assign(devEnv, { api });
  return devEnv as DevEnvironment & { api: typeof api };
}
