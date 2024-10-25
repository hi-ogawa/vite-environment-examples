import assert from "node:assert";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";
import { createSSEClient } from "./sse-client";
import type { BridgeClientOptions } from "./types";

export function createBridgeClient(options: BridgeClientOptions) {
  let sseClient: Awaited<ReturnType<typeof createSSEClient>>;

  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        async send(payload) {
          assert(sseClient);
          sseClient.send(payload);
        },
        async connect(handlers) {
          sseClient = await createSSEClient(
            options.bridgeUrl +
              "/sse?" +
              new URLSearchParams({ key: options.key }),
            handlers,
          );
        },
        timeout: 2000,
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

  async function handler(request: Request): Promise<Response> {
    try {
      const headers = request.headers;
      const meta = JSON.parse(headers.get("x-vite-meta")!);
      headers.delete("x-vite-meta");
      const mod = await runner.import(meta.entry);
      return mod.default(new Request(meta.url, { ...request, headers }));
    } catch (e) {
      console.error(e);
      const message =
        "[bridge client handler error]\n" +
        (e instanceof Error ? `${e.stack ?? e.message}` : "");
      return new Response(message, { status: 500 });
    }
  }

  return { runner, handler };
}
