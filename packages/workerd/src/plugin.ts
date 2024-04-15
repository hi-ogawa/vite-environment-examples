import {
  Miniflare,
  type WorkerOptions,
  Request as MiniflareRequest,
  Response as MiniflareResponse,
  mergeWorkerOptions,
  type SharedOptions,
} from "miniflare";
import { fileURLToPath } from "url";
import { DefaultMap, tinyassert } from "@hiogawa/utils";
import {
  ANY_URL,
  RUNNER_INIT_PATH,
  setRunnerFetchOptions,
  type RunnerEvalOptions,
  RUNNER_EVAL_PATH,
  type RunnerEvalFn,
} from "./shared";
import {
  DevEnvironment,
  type CustomPayload,
  type HMRChannel,
  type Plugin,
  type ViteDevServer,
  type PluginOption,
} from "vite";
import { createMiddleware } from "@hattip/adapter-node/native-fetch";
import type { SourcelessWorkerOptions } from "wrangler";

interface WorkerdPluginOptions extends WorkerdEnvironmentOptions {
  entry?: string;
}

interface WorkerdEnvironmentOptions {
  miniflare?: SharedOptions & SourcelessWorkerOptions;
  wrangler?: {
    configPath?: string;
  };
}

//
// traditional middleware plugin
//

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
      const entry = pluginOptions.entry;
      if (!entry) {
        return;
      }
      const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;
      const nodeMiddleware = createMiddleware(
        (ctx) => devEnv.api.dispatchFetch(entry, ctx.request),
        { alwaysCallNext: false },
      );
      return () => {
        server.middlewares.use(nodeMiddleware);
      };
    },
  };
}

//
// remote runner plugin
//

export function vitePluginWorkerdRunner(
  pluginOptions: WorkerdPluginOptions,
): PluginOption {
  const configPlugin: Plugin = {
    name: vitePluginWorkerdRunner.name,
    async config(_config, _env) {
      return {
        environments: {
          workerd: {
            dev: {
              createEnvironment: async (server, name) => {
                const devEnv = await createWorkerdDevEnvironment(
                  server,
                  name,
                  pluginOptions,
                );
                const entry = fileURLToPath(
                  new URL("./remote-eval-entry.js", import.meta.url),
                );
                const response = devEnv.api.dispatchFetch(
                  entry,
                  new Request("https://any.local", {
                    headers: {},
                    body: "",
                  }),
                );
                response;
                return devEnv;
              },
            },
          },
        },
      };
    },
  };
  // dispatchFetch
  //

  // import proxy entry

  return [configPlugin];
}

//
// WorkerdDevEnvironment factory
//

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
    ...pluginOptions.miniflare,
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

  // websocket hmr channgel
  const hot = createSimpleHMRChannel({
    name,
    post: (data) => webSocket.send(data),
    on: (listener) => {
      webSocket.addEventListener("message", listener);
      return () => {
        webSocket.removeEventListener("message", listener);
      };
    },
    serialize: (v) => JSON.stringify(v),
    deserialize: (v) => JSON.parse(v.data),
  });

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
    // fetch proxy
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

    // playwright-like eval interface https://playwright.dev/docs/evaluating
    // (de)serialization can be customized (currently JSON.stringify/parse)
    async eval(entry: string, fn: RunnerEvalFn, ...args: any[]): Promise<any> {
      const res = await runnerObject.fetch(ANY_URL + RUNNER_EVAL_PATH, {
        method: "POST",
        body: JSON.stringify({
          entry,
          fnString: fn.toString(),
          args,
        } satisfies RunnerEvalOptions),
      });
      tinyassert(res.ok);
      return (await res.json()) as any;
    },
  };

  // workaround for tsup dts?
  Object.assign(devEnv, { api });
  return devEnv as DevEnvironment & { api: typeof api };
}

// cf.
// https://github.com/vitejs/vite/blob/feat/environment-api/packages/vite/src/node/server/hmr.ts/#L909-L910
// https://github.com/vitejs/vite/blob/feat/environment-api/packages/vite/src/node/ssr/runtime/serverHmrConnector.ts/#L33-L34
function createSimpleHMRChannel(options: {
  name: string;
  post: (data: any) => any;
  on: (listener: (data: any) => void) => () => void;
  serialize: (v: any) => any;
  deserialize: (v: any) => any;
}): HMRChannel {
  const listerMap = new DefaultMap<string, Set<Function>>(() => new Set());
  let dispose: (() => void) | undefined;

  return {
    name: options.name,
    listen() {
      dispose = options.on((data) => {
        const payload = options.deserialize(data) as CustomPayload;
        for (const f of listerMap.get(payload.event)) {
          f(payload.data);
        }
      });
    },
    close() {
      dispose?.();
      dispose = undefined;
    },
    on(event: string, listener: (...args: any[]) => any) {
      listerMap.get(event).add(listener);
    },
    off(event: string, listener: (...args: any[]) => any) {
      listerMap.get(event).delete(listener);
    },
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
      options.post(options.serialize(payload));
    },
  };
}
