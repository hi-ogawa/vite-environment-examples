import { tinyassert } from "@hiogawa/utils";
import { RUNNER_INIT_PATH, type RunnerEnv } from "./shared";
import { ModuleRunner } from "vite/module-runner";

export class RunnerObject implements DurableObject {
  #env: RunnerEnv;
  #runner: ModuleRunner | undefined;

  constructor(_state: DurableObjectState, env: RunnerEnv) {
    this.#env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === RUNNER_INIT_PATH) {
      const { 0: ws1, 1: ws2 } = new WebSocketPair();
      (ws1 as any).accept();

      tinyassert(!this.#runner);
      this.#runner = new ModuleRunner(
        {
          root: this.#env.__viteRoot,
          sourcemapInterceptor: "prepareStackTrace",
          transport: {
            fetchModule: async (...args) => {
              const response = await this.#env.__viteFetchModule.fetch(
                new Request("https://any.local", {
                  method: "POST",
                  body: JSON.stringify(args),
                }),
              );
              tinyassert(response.ok);
              const result = response.json();
              return result as any;
            },
          },
          // TODO: use WebSocketPair
          hmr: false,
        },
        {
          runInlinedModule: async (context, transformed, id) => {
            const codeDefinition = `'use strict';async (${Object.keys(
              context,
            ).join(",")})=>{{`;
            const code = `${codeDefinition}${transformed}\n}}`;
            const fn = this.#env.__viteUnsafeEval.eval(code, id);
            await fn(...Object.values(context));
            Object.freeze(context.__vite_ssr_exports__);
          },
          async runExternalModule(filepath) {
            console.log("[runExternalModule]", filepath);
            return import(filepath);
          },
        },
      );
      return new Response(null, { status: 101, webSocket: ws2 });
    }

    tinyassert(this.#runner);
    const mod = await this.#runner.import(this.#env.__viteEntry);
    return mod.default.fetch(request, this.#env);
  }
}
