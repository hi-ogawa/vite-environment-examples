// @ts-check

import assert from "node:assert";
import fs from "node:fs";
import readline from "node:readline";
import { Writable } from "node:stream";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

/**
 * @param {import("./types").BridgeClientOptions} options
 */
export function createBridgeClient(options) {
  /**
   * @param {string} method
   * @param  {...any} args
   * @returns {Promise<any>}
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

  // TODO: birpc
  const childIn = readline.createInterface(process.stdin);
  const childOut = new Writable({
    write(chunk, _encoding, callback) {
      fs.write(3, chunk, callback);
    },
  });

  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        fetchModule: async (...args) => {
          const id = Math.random().toString(36).slice(2);
          const promise = new Promise((resolve, _reject) => {
            /**
             * @param {string} line
             */
            function handler(line) {
              const event = JSON.parse(line);
              if (event.id === id) {
                childIn.off("line", handler);
                resolve(event.result);
              }
            }
            childIn.on("line", handler);
          });
          childOut.write(
            JSON.stringify({ type: "fetchModule", id, args }) + "\n",
          );
          return promise;
        },
      },
      hmr: false,
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
