import { Miniflare } from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert, createManualPromise } from "@hiogawa/utils";

// npx tsx examples/workerd/src/example3/main.ts

const DO_NAME = "__do";

async function main() {
  const mf = new Miniflare({
    modulesRoot: "/",
    modules: [
      {
        type: "ESModule",
        path: fileURLToPath(new URL("./worker.mjs", import.meta.url)),
      },
    ],
    durableObjects: {
      [DO_NAME]: "MyDurableObject",
    },
  });

  const ns = await mf.getDurableObjectNamespace(DO_NAME);
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
