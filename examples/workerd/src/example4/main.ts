import { Log, Miniflare } from "miniflare";
import { fileURLToPath } from "url";
import { tinyassert } from "@hiogawa/utils";
import { RUNNER_INIT_PATH, UNSAFE_EVAL_BINDING } from "./shared";
import { DevEnvironment, RemoteEnvironmentTransport, createServer } from "vite";

// pnpm -C examples/workerd dev
// npx tsx examples/workerd/src/example4/main.ts

const RUNNER_OBJECT_BINDING = "__VITE_RUNNER";

async function main() {
  const mf = new Miniflare({
    log: new Log(),
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
    unsafeEvalBinding: UNSAFE_EVAL_BINDING,
  });

  const ns = await mf.getDurableObjectNamespace(RUNNER_OBJECT_BINDING);
  const runnerObject = ns.get(ns.idFromName(""));

  const root = fileURLToPath(new URL(".", import.meta.url));
  const wsRes = await runnerObject.fetch(
    "http://test.local" +
      RUNNER_INIT_PATH +
      "?" +
      new URLSearchParams({ root }),
    {
      headers: {
        Upgrade: "websocket",
      },
    },
  );
  tinyassert(wsRes.webSocket);
  const ws = wsRes.webSocket;
  ws.accept();

  const viteDevServer = await createServer({
    root,
    configFile: false,
    server: {
      middlewareMode: true,
      watch: null,
    },
    environments: {
      workerd: {
        dev: {
          createEnvironment: (server, name) => {
            return new DevEnvironment(server, name, {
              runner: {
                transport: new RemoteEnvironmentTransport({
                  send: (data) => ws.send(JSON.stringify(data)),
                  onMessage: (handler) => {
                    ws.addEventListener("message", (event) => {
                      tinyassert(typeof event.data === "string");
                      handler(JSON.parse(event.data));
                    });
                  },
                }),
              },
            });
          },
        },
      },
    },
  });
  const workerdEnv = viteDevServer.environments["workerd"];
  tinyassert(workerdEnv);

  const res = await runnerObject.fetch("http://test.local");
  console.log("[response]", {
    status: res.status,
    headers: Object.fromEntries(res.headers),
    text: await res.text(),
  });

  await mf.dispose();
  await viteDevServer.close();
}

main();
