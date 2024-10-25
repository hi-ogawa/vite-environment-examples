// @ts-check

import assert from "node:assert";
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

  let clientId = Math.random().toString(36).slice(2);

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
              "x-client-id": clientId,
            },
          });
          assert(response.ok);
        },
        async connect(handlers) {
          const response = await fetch(options.bridgeUrl + "/connect", {
            method: "POST",
            // TODO: use request stream for bidirectional communication
            body: null,
            headers: {
              "x-key": options.key,
              "x-client-id": clientId,
            },
          });
          assert(response.body);
          response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(splitTransform("\n\n"))
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  // console.log("[runner.onMessage]", chunk);
                  if (chunk.startsWith("data: ")) {
                    const payload = JSON.parse(chunk.slice("data: ".length));
                    handlers.onMessage(payload);
                  }
                },
                abort(e) {
                  console.log("[runner.abort]", e);
                },
                close() {
                  console.log("[runner.close]");
                },
              }),
            );
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

/**
 * @param {string} sep
 * @returns {TransformStream<string, string>}
 */
function splitTransform(sep) {
  let pending = "";
  return new TransformStream({
    transform(chunk, controller) {
      while (true) {
        const i = chunk.indexOf(sep);
        if (i >= 0) {
          pending += chunk.slice(0, i);
          controller.enqueue(pending);
          pending = "";
          chunk = chunk.slice(i + sep.length);
          continue;
        }
        pending += chunk;
        break;
      }
    },
  });
}
