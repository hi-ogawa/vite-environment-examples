import {
  Log,
  Miniflare,
  type MiniflareOptions,
  type WorkerOptions,
  Request as MiniflareRequest,
  Response as MiniflareResponse,
} from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert } from "@hiogawa/utils";
import { ANY_URL, RUNNER_INIT_PATH, type RunnerEnv } from "./shared";
import {
  DevEnvironment,
  type HMRChannel,
  type Plugin,
  type ViteDevServer,
} from "vite";
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
              createEnvironment: (server, name) =>
                createWorkerdDevEnvironment(server, name, pluginOptions),
            },
          },
        },
      };
    },

    configureServer(server) {
      return () => {
        // TODO: allow interface merging so users can register typing?
        const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;

        server.middlewares.use(
          createMiddleware((ctx) => devEnv.api.fetch(ctx.request), {
            alwaysCallNext: false,
          }),
        );
      };
    },
  };
}

export type WorkerdDevEnvironment = DevEnvironment & {
  api: WorkerdDevEnvironmentApi;
};

type WorkerdDevEnvironmentApi = {
  setEntry(entry: string): void;
  fetch(request: Request): Promise<Response>;
};

async function createWorkerdDevEnvironment(
  server: ViteDevServer,
  name: string,
  pluginOptions: WorkerdPluginOptions,
) {
  // setup miniflare with a durable object script
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
      // TODO: can set entry later?
      __viteEntry: pluginOptions.entry,
    } satisfies Omit<RunnerEnv, "__viteUnsafeEval" | "__viteFetchModule">,
  };
  pluginOptions.options?.(miniflareOptions);
  const miniflare = new Miniflare(miniflareOptions);

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

  // inheritance to extend dispose + custom api
  class WorkerdDevEnvironment extends DevEnvironment {
    override async close() {
      await super.close();
      await miniflare.dispose();
    }

    // TODO: custom api for environment users?
    // TODO: can proxy entire `SELF` like vitest integration?
    // https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/
    api: WorkerdDevEnvironmentApi = {
      setEntry(entry) {
        entry;
      },

      async fetch(request: Request) {
        const req = new MiniflareRequest(request.url, {
          method: request.method,
          headers: request.headers,
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
  }

  return new WorkerdDevEnvironment(server, name, { hot });
}
