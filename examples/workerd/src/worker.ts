import { tinyassert } from "@hiogawa/utils";
import { ANY_URL, RUNNER_INIT_PATH, type RunnerEnv } from "./shared";
import { ModuleRunner } from "vite/module-runner";

export class RunnerObject implements DurableObject {
  #env: RunnerEnv;
  #runner?: ModuleRunner;
  // #entry?: string;

  constructor(_state: DurableObjectState, env: RunnerEnv) {
    this.#env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === RUNNER_INIT_PATH) {
      const { 0: webSocket, 1: webSocketReturn } = new WebSocketPair();
      (webSocket as any).accept();
      tinyassert(!this.#runner);
      this.#runner = createRunner(this.#env, webSocket);
      return new Response(null, { status: 101, webSocket: webSocketReturn });
    }

    tinyassert(this.#runner);
    const mod = await this.#runner.import(this.#env.__viteEntry);
    return mod.default.fetch(request, this.#env);
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
            webSocket.addEventListener("message", (event) => {
              callback(JSON.parse(event.data));
            });
          },
          send(messages) {
            webSocket.send(JSON.stringify(messages));
          },
        },
      },
    },
    {
      runInlinedModule: async (context, transformed, id) => {
        const codeDefinition = `'use strict';async (${Object.keys(context).join(
          ",",
        )})=>{{`;
        const code = `${codeDefinition}${transformed}\n}}`;
        const fn = env.__viteUnsafeEval.eval(code, id);
        await fn(...Object.values(context));
        Object.freeze(context.__vite_ssr_exports__);
      },
      async runExternalModule(filepath) {
        console.log("[runExternalModule]", filepath);
        return import(filepath);
      },
    },
  );
}
