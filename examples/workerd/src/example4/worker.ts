import { tinyassert } from "@hiogawa/utils";
import { RUNNER_INIT_PATH, UNSAFE_EVAL_BINDING } from "./shared";
import { ModuleRunner, RemoteRunnerTransport } from "vite/module-runner";

export class RunnerObject implements DurableObject {
  #runner: ModuleRunner | undefined;
  #env: any;

  constructor(_state: DurableObjectState, env: any) {
    this.#env = env;
  }

  async fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === RUNNER_INIT_PATH) {
      const { 0: ws1, 1: ws2 } = new WebSocketPair();
      (ws1 as any).accept();

      tinyassert(!this.#runner);
      const root = url.searchParams.get("root");
      tinyassert(root);
      this.#runner = new ModuleRunner(
        {
          root,
          sourcemapInterceptor: "prepareStackTrace",
          transport: new RemoteRunnerTransport({
            onMessage: (listener) => {
              ws1.addEventListener("message", (event) => {
                listener(JSON.parse(event.data));
              });
            },
            send: (message) => {
              ws1.send(JSON.stringify(message));
            },
          }),
          // TODO
          hmr: false,
        },
        {
          runInlinedModule: async (context, transformed, id) => {
            const codeDefinition = `'use strict';async (${Object.keys(
              context,
            ).join(",")})=>{{`;
            const code = `${codeDefinition}${transformed}\n}}`;
            const fn = this.#env[UNSAFE_EVAL_BINDING].eval(code, id);
            await fn(...Object.values(context));
            Object.freeze(context.__vite_ssr_exports__);
          },
          runExternalModule(filepath) {
            return import(filepath);
          },
        },
      );
      return new Response(null, { status: 101, webSocket: ws2 });
    }

    tinyassert(this.#runner);
    const mod = await this.#runner.import("/src/entry.ts");
    return new Response(mod.default());
  }
}
