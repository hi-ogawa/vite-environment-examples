import { DurableObject } from "cloudflare:workers";
import { objectPickBy, tinyassert } from "@hiogawa/utils";
import {
  ModuleRunner,
  ssrImportMetaKey,
  ssrModuleExportsKey,
} from "vite/module-runner";
import {
  ANY_URL,
  type FetchMetadata,
  RUNNER_INIT_PATH,
  type RunnerEnv,
} from "./shared";

export class RunnerObject extends DurableObject {
  #env: RunnerEnv;
  #runner?: ModuleRunner;

  constructor(...args: ConstructorParameters<typeof DurableObject>) {
    super(...args);
    this.#env = args[1] as RunnerEnv;
  }

  override async fetch(request: Request) {
    try {
      return await this.#fetch(request);
    } catch (e) {
      console.error(e);
      let body = "[vite workerd runner error]\n";
      if (e instanceof Error) {
        body += `${e.stack ?? e.message}`;
      }
      return new Response(body, { status: 500 });
    }
  }

  async __vite_init() {
    console.log("!!vite init!!");
    return "foo";
  }

  // TODO
  async __viteServerSend(payload: string) {
    payload;
  }

  async #fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === RUNNER_INIT_PATH) {
      const pair = new WebSocketPair();
      (pair[0] as any).accept();
      tinyassert(!this.#runner);
      this.#runner = createRunner(this.#env, pair[0]);
      return new Response(null, { status: 101, webSocket: pair[1] });
    }

    tinyassert(this.#runner);
    const options = JSON.parse(
      request.headers.get("x-vite-fetch")!,
    ) as FetchMetadata;
    const mod = await this.#runner.import(options.entry);
    const handler = mod.default as ExportedHandler;
    tinyassert(handler.fetch);

    const env = objectPickBy(this.#env, (_v, k) => !k.startsWith("__vite"));
    return handler.fetch(request, env, {
      waitUntil(_promise: Promise<any>) {},
      passThroughOnException() {},
      abort(_reason?: any) {},
    });
  }
}

function createRunner(env: RunnerEnv, webSocket: WebSocket) {
  return new ModuleRunner(
    {
      root: env.__viteRoot,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        fetchModule: async (...args) => {
          const response = await env.__viteFetchModule.fetch(
            new Request(ANY_URL, {
              method: "POST",
              body: JSON.stringify(args),
            }),
          );
          tinyassert(response.ok);
          const result = response.json();
          return result as any;
        },
      },
      hmr: {
        connection: {
          isReady: () => true,
          onUpdate(callback) {
            // TODO
            webSocket.addEventListener("message", (event) => {
              callback(JSON.parse(event.data));
            });
          },
          send(payload) {
            env.__viteRunnerSend.fetch(
              new Request(ANY_URL, {
                method: "POST",
                body: JSON.stringify(payload),
              }),
            );
          },
        },
      },
    },
    {
      runInlinedModule: async (context, transformed) => {
        const codeDefinition = `'use strict';async (${Object.keys(context).join(
          ",",
        )})=>{{`;
        const code = `${codeDefinition}${transformed}\n}}`;
        const fn = env.__viteUnsafeEval.eval(
          code,
          context[ssrImportMetaKey].filename,
        );
        await fn(...Object.values(context));
        Object.freeze(context[ssrModuleExportsKey]);
      },
      async runExternalModule(filepath) {
        return import(filepath);
      },
    },
  );
}
