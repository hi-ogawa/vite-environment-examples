import assert from "node:assert";
import http from "node:http";
import { webToNodeHandler } from "@hiogawa/utils-node";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

async function main() {
  // @ts-ignore
  const { bridgeUrl, root } = JSON.parse(process.argv[2]);

  /**
   *
   * @param {string} method
   * @param  {...any} args
   * @returns
   */
  async function bridgeRpc(method, ...args) {
    const response = await fetch(bridgeUrl + "/rpc", {
      method: "POST",
      body: JSON.stringify({ method, args }),
    });
    assert(response.ok);
    const result = response.json();
    return result;
  }

  const runner = new ModuleRunner(
    {
      root,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        fetchModule: (...args) => bridgeRpc("fetchModule", ...args),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

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
        "[node runner error]\n" +
        (e instanceof Error ? `${e.stack ?? e.message}` : "");
      return new Response(message, { status: 500 });
    }
  }

  const listener = webToNodeHandler(handler);

  const server = http.createServer((req, res) => {
    listener(req, res, (e) => console.error(e));
  });

  server.listen(async () => {
    const address = server.address();
    assert(address && typeof address !== "string");
    await bridgeRpc("register", `http://localhost:${address.port}`);
  });
}

main();
