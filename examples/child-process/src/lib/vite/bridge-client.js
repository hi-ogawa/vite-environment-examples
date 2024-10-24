// @ts-check

import assert from "node:assert";
import { EventSourcePlus } from "event-source-plus";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

/**
 * @param {import("./types").BridgeClientOptions} options
 */
export function createBridgeClient(options) {
  /**
   * @param {string} method
   * @param  {...any} args
   * @returns {Promise<any>}
   * TODO: not used
   */
  async function rpc(method, ...args) {
    const response = await fetch(options.bridgeUrl + "/rpc", {
      method: "POST",
      body: JSON.stringify({ method, args, key: options.key }),
    });
    assert(response.ok);
    const result = response.json();
    return result;
  }

  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        async send(payload) {
          const response = await fetch(options.bridgeUrl + "/send", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: {
              "x-key": options.key,
            },
          });
          assert(response.ok);
        },
        async connect(handlers) {
          // https://github.com/joshmossas/event-source-plus
          const source = new EventSourcePlus(options.bridgeUrl + "/connect", {
            maxRetryCount: 0,
            headers: {
              "x-key": options.key,
            },
          });
          const controller = source.listen({
            onMessage(message) {
              console.log("[runner.onMessage]", message);
              handlers.onMessage(JSON.parse(message.data));
            },
            onRequestError: (ctx) => console.error("[onRequestError]", ctx),
            onResponseError: (ctx) => console.error("[onResponseError]", ctx),
          });
          controller.signal.addEventListener("abort", (e) => {
            console.log("[runner.abort]", e);
            handlers.onDisconnection();
          });
        },
        timeout: 2000,
      },
      // hmr: true,
    },
    new ESModulesEvaluator(),
  );

  // TODO: move this out
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async function handler(request) {
    try {
      const headers = request.headers;
      // @ts-ignore
      const meta = JSON.parse(headers.get("x-vite-meta"));
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

  return { runner, rpc, handler };
}
