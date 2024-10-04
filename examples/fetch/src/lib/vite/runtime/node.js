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
      transport: {
        fetchModule: (...args) => bridgeRpc("fetchModule", ...args),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

  const listener = webToNodeHandler(async (request) => {
    const headers = request.headers;
    // @ts-ignore
    const meta = JSON.parse(headers.get("x-vite-meta"));
    headers.delete("x-vite-meta");
    assert(meta);
    const mod = await runner.import(meta.entry);
    return mod.default(new Request(meta.url, { ...request, headers }));
  });

  const server = http.createServer((req, res) => {
    listener(req, res, (e) => {
      if (e) {
        console.error(e);
        res.statusCode = 500;
        res.end(
          "[runner error]\n" +
            (e instanceof Error ? `${e.stack ?? e.message}` : ""),
        );
      } else {
        res.statusCode = 404;
      }
    });
  });

  server.listen(async () => {
    const address = server.address();
    assert(address && typeof address !== "string");
    await bridgeRpc("register", `http://localhost:${address.port}`);
  });
}

main();
