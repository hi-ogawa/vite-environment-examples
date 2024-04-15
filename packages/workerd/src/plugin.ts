import {
  Miniflare,
  type WorkerOptions,
  Response as MiniflareResponse,
  mergeWorkerOptions,
  type SharedOptions,
} from "miniflare";
import { fileURLToPath } from "url";
import { DefaultMap, tinyassert } from "@hiogawa/utils";
import {
  ANY_URL,
  RUNNER_INIT_PATH,
  RUNNER_EVAL_PATH,
  type EvalApi,
  type EvalMetadata,
  type FetchMetadata,
} from "./shared";
import {
  DevEnvironment,
  type CustomPayload,
  type HMRChannel,
  type Plugin,
  type ViteDevServer,
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

export type WorkerdDevEnvironment = DevEnvironment & {
  api: WorkerdDevApi;
};

type WorkerdDevApi = {
  dispatchFetch: (entry: string, request: Request) => Promise<Response>;
  eval: EvalApi;
};

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
  class WorkerdDevEnvironmentImpl extends DevEnvironment {
    override async close() {
      await super.close();
      await miniflare.dispose();
    }
  }

  const devEnv = new WorkerdDevEnvironmentImpl(server, name, { hot });

  // custom environment api
  const api: WorkerdDevApi = {
    // fetch proxy
    async dispatchFetch(entry: string, request: Request) {
      const headers = new Headers(request.headers);
      headers.set(
        "x-vite-fetch",
        JSON.stringify({ entry } satisfies FetchMetadata),
      );
      const fetch_ = runnerObject.fetch as any as typeof fetch; // fix web/undici types
      const res = await fetch_(request.url, {
        method: request.method,
        headers,
        body: request.body as any,
        redirect: "manual",
        // @ts-ignore undici
        duplex: "half",
      });
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    },

    // playwright-like eval interface https://playwright.dev/docs/evaluating
    eval: async (ctx) => {
      const headers = new Headers();
      headers.set(
        "x-vite-eval",
        JSON.stringify({
          entry: ctx.entry,
          fnString: ctx.fn.toString(),
        } satisfies EvalMetadata),
      );
      const body = JSON.stringify(ctx.data as any);
      const fetch_ = runnerObject.fetch as any as typeof fetch; // fix web/undici types
      const response = await fetch_(ANY_URL + RUNNER_EVAL_PATH, {
        method: "POST",
        headers,
        body,
        // @ts-ignore undici
        duplex: "half",
      });
      tinyassert(response.ok);
      const result = await response.json();
      return result as any;
    },
  };

  return Object.assign(devEnv, { api }) as WorkerdDevEnvironment;
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
