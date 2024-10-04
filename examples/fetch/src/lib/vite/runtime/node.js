import http from "node:http";
import { webToNodeHandler } from "@hiogawa/utils-node";
import { createFetchRunner } from "../client.js";

/** @type {import("vite/module-runner").ModuleRunner} */
let runner;

async function main() {
  const listener = webToNodeHandler(handler);

  const server = http.createServer((req, res) => {
    listener(req, res, (e) => {
      if (e) {
        console.error(e);
        res.statusCode = 500;
        res.end(
          "[vite runner error]\n" +
            (e instanceof Error ? `${e.stack ?? e.message}` : ""),
        );
      } else {
        res.statusCode = 404;
      }
    });
  });

  createFetchRunner;

  server.listen(() => {
    const address = server.address();
    if (!address || typeof address === "string") throw "todo";

    // TODO: need to know vite server origin..
    // fetch(new URL("./")),
    address.port;

    console.log(server.address());
    // fetch("http://localhost:???/__vite_ready");
  });
}

/**
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__vite_init") {
  }

  const headers = request.headers;
  // @ts-ignore
  const meta = JSON.parse(headers.get("x-vite-meta"));
  headers.delete("x-vite-meta");
  if (!meta) throw "todo";

  runner;

  const mod = await import(meta.entry);
  return mod.default(new Request(meta.url, { ...request, headers }));
}

main();
