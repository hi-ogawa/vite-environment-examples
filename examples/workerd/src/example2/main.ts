import { Miniflare } from "miniflare";
import { fileURLToPath } from "url";

// npx tsx examples/workerd/src/example2/main.ts

async function main() {
  const mf = new Miniflare({
    modulesRoot: "/",
    modules: [
      {
        type: "ESModule",
        path: fileURLToPath(new URL("./worker.mjs", import.meta.url)),
      },
    ],
  });
  const res = await mf.dispatchFetch("https://test.local/hello");
  console.log("[node] response", {
    status: res.status,
    headers: Object.fromEntries(res.headers),
    text: await res.text(),
  });
  await mf.dispose();
}

main();
