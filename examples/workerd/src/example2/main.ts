import { Miniflare } from "miniflare";
import { fileURLToPath } from "url";

// npx tsx examples/workerd/src/example2/main.ts

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
      [DO_NAME]: {
        className: "MyDurableObject",
        // need this dark magic?
        // unsafeUniqueKey: kUnsafeEphemeralUniqueKey,
        // unsafePreventEviction: true,
      },
    },
  });

  const ns = await mf.getDurableObjectNamespace(DO_NAME);
  const stub = ns.get(ns.idFromName(""));
  const res = await stub.fetch("http://test.local/hello");
  console.log("[response]", {
    status: res.status,
    headers: Object.fromEntries(res.headers),
    text: await res.text(),
  });
  await mf.dispose();
}

main();
