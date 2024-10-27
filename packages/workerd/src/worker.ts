import { DurableObject } from "cloudflare:workers";
import { objectPickBy, tinyassert } from "@hiogawa/utils";
import type { HotPayload } from "vite";
import {
  ModuleRunner,
  ssrImportMetaKey,
  ssrModuleExportsKey,
} from "vite/module-runner";
import {
  ANY_URL,
  type FetchMetadata,
  type RunnerEnv,
  type RunnerRpc,
} from "./shared";

export class RunnerObject extends DurableObject implements RunnerRpc {
  #env: RunnerEnv;
  #runner?: ModuleRunner;
  #viteServerSend!: (payload: HotPayload) => void;

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

  async __viteInit() {
    const env = this.#env;
    this.#runner = new ModuleRunner(
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
            onUpdate: (callback) => {
              this.#viteServerSend = callback;
            },
            send: (payload) => {
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
          const codeDefinition = `'use strict';async (${Object.keys(
            context,
          ).join(",")})=>{{`;
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

  async __viteServerSend(payload: any) {
    this.#viteServerSend(payload);
  }

  async #fetch(request: Request) {
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
