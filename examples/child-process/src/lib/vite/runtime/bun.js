import assert from "node:assert";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

async function main() {
  // @ts-ignore
  const { bridgeUrl, root } = JSON.parse(process.argv[2]);

  /**
   * @param {string} method
   * @param  {...any} args
   * @returns {Promise<any>}
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
    const headers = request.headers;
    // @ts-ignore
    const meta = JSON.parse(headers.get("x-vite-meta"));
    headers.delete("x-vite-meta");
    const mod = await runner.import(meta.entry);
    return mod.default(new Request(meta.url, { ...request, headers }));
  }

  const server = Bun.serve({ port: 0, fetch: handler });
  await bridgeRpc("register", `http://localhost:${server.port}`);
}

main();
