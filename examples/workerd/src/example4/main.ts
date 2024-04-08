import { Miniflare } from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert, createManualPromise } from "@hiogawa/utils";

// pnpm -C examples/workerd dev
// npx tsx examples/workerd/src/example4/main.ts

const RUNNER_OBJECT_BINDING = "__VITE_RUNNER";

async function main() {
  const mf = new Miniflare({
    modulesRoot: "/",
    modules: [
      {
        type: "ESModule",
        path: fileURLToPath(new URL("./dist/worker.js", import.meta.url)),
      },
    ],
    durableObjects: {
      [RUNNER_OBJECT_BINDING]: "RunnerObject",
    },
  });

  const ns = await mf.getDurableObjectNamespace(RUNNER_OBJECT_BINDING);
  const stub = ns.get(ns.idFromName(""));
  const res = await stub.fetch("http://test.local/hello", {
    headers: {
      Upgrade: "websocket",
    },
  });
  tinyassert(res.webSocket);
  const promise = createManualPromise<unknown>();
  res.webSocket.addEventListener("message", (data) => {
    promise.resolve(data);
  });
  res.webSocket.accept();
  res.webSocket.send("hello");
  const data = await promise;
  console.log(data);
  await mf.dispose();
}

main();
