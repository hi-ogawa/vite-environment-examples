import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Fetcher } from "@cloudflare/workers-types/experimental";
import { webToNodeHandler } from "@hiogawa/utils-node";
import {
  Miniflare,
  Response as MiniflareResponse,
  type SharedOptions,
  type WorkerOptions,
  mergeWorkerOptions,
} from "miniflare";
import {
  DevEnvironment,
  type HotChannel,
  type HotPayload,
  type Plugin,
  type ResolvedConfig,
} from "vite";
import type { SourcelessWorkerOptions } from "wrangler";
import { type FetchMetadata, type RunnerRpc } from "./shared";

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
            keepProcessEnv: false,
            optimizeDeps: {
              // prevent `import { createRequire } from "node:module"`
              esbuildOptions: {
                platform: "browser",
                banner: undefined,
              },
            },
            dev: {
              createEnvironment: (name, config) =>
                createWorkerdDevEnvironment(name, config, pluginOptions),
            },
            build: pluginOptions.entry
              ? {
                  ssr: true,
                  rollupOptions: {
                    input: {
                      index: pluginOptions.entry,
                    },
                  },
                }
              : undefined,
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
      const nodeMiddleware = webToNodeHandler((request) =>
        devEnv.api.dispatchFetch(entry, request),
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
};

export async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
  pluginOptions: WorkerdEnvironmentOptions,
) {
  const workerPath = fileURLToPath(new URL("./worker.js", import.meta.url));
  const workerContent = readFileSync(workerPath, "utf-8");
  const viteModuleRunnerPath = fileURLToPath(
    import.meta.resolve("vite/module-runner"),
  );
  const viteModuleRunnerContent = readFileSync(
    viteModuleRunnerPath,
    "utf-8",
    // avoid new AsyncFunction during import side effect
  ).replace(`new AsyncFunction("a", "b", body).toString()`, `""`);

  // setup miniflare with a durable object script to run vite module runner
  let runnerWorkerOptions: WorkerOptions = {
    modules: [
      {
        type: "ESModule",
        path: "__vite_worker__",
        contents: workerContent,
      },
      {
        type: "ESModule",
        path: "vite/module-runner",
        contents: viteModuleRunnerContent,
      },
    ],
    durableObjects: {
      __viteRunner: "RunnerObject",
    },
    unsafeEvalBinding: "__viteUnsafeEval",
    serviceBindings: {
      __viteRunnerSend: async (request) => {
        const payload = (await request.json()) as HotPayload;
        hotListener.dispatch(payload, { send: runnerObject.__viteServerSend });
        return MiniflareResponse.json(null);
      },
    },
    bindings: {
      __viteRoot: config.root,
    },
  };

  // https://github.com/cloudflare/workers-sdk/blob/2789f26a87c769fc6177b0bdc79a839a15f4ced1/packages/vitest-pool-workers/src/pool/config.ts#L174-L195
  if (pluginOptions.wrangler?.configPath) {
    const wrangler = await import("wrangler");
    const wranglerOptions = wrangler.unstable_getMiniflareWorkerOptions(
      pluginOptions.wrangler.configPath,
    );
    // TODO: could this be useful to not delete?
    delete wranglerOptions.workerOptions.sitePath;
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
  const runnerObject = ns.get(ns.idFromName("")) as any as Fetcher & RunnerRpc;

  // init via rpc
  await runnerObject.__viteInit();

  // hmr channel
  const hotListener = createHotListenerManager();
  const hot: HotChannel = {
    listen: () => {},
    close: () => {},
    on: hotListener.on,
    off: hotListener.off,
    send: runnerObject.__viteServerSend,
  };

  // TODO: move initialization code to `init`?
  // inheritance to extend dispose
  class WorkerdDevEnvironmentImpl extends DevEnvironment {
    override async close() {
      await super.close();
      await miniflare.dispose();
    }
  }

  const devEnv = new WorkerdDevEnvironmentImpl(name, config, {
    transport: hot,
    hot: true,
  });

  // custom environment api
  const api: WorkerdDevApi = {
    // fetch proxy
    async dispatchFetch(entry: string, request: Request) {
      const headers = new Headers(request.headers);
      headers.set(
        "x-vite-fetch",
        JSON.stringify({ entry } satisfies FetchMetadata),
      );
      const res = await runnerObject.fetch(request.url, {
        method: request.method,
        headers,
        body: request.body as any,
        redirect: "manual",
        // @ts-ignore undici
        duplex: "half",
      });
      return new Response(res.body as any, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers as any,
      });
    },
  };

  return Object.assign(devEnv, { api }) as WorkerdDevEnvironment;
}

// wrapper to simplify listener management
function createHotListenerManager(): Pick<HotChannel, "on" | "off"> & {
  dispatch: (
    payload: HotPayload,
    client: { send: (payload: HotPayload) => void },
  ) => void;
} {
  const listerMap: Record<string, Set<Function>> = {};
  const getListerMap = (e: string) => (listerMap[e] ??= new Set());

  return {
    on(event: string, listener: Function) {
      getListerMap(event).add(listener);
    },
    off(event, listener: any) {
      getListerMap(event).delete(listener);
    },
    dispatch(payload, client) {
      if (payload.type === "custom") {
        for (const lister of getListerMap(payload.event)) {
          lister(payload.data, client, payload.invoke);
        }
      }
    },
  };
}
