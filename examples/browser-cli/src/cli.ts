import { createServer, type Plugin, type ViteDevServer } from "vite";
import repl from "node:repl";
import { createManualPromise, tinyassert } from "@hiogawa/utils";
import nodeStream from "node:stream";
import { chromium } from "@playwright/test";

const headless = !process.env["CLI_HEADED"];
const extension = process.env["CLI_EXT"] ?? "tsx";

async function main() {
  const server = await createServer({
    clearScreen: false,
    appType: "custom",
    plugins: [vitePluginVirtualEval({ extension }), vitePluginBrowserRunner()],
    environments: {
      custom: {
        nodeCompatible: false,
        webCompatible: true,
        resolve: {
          noExternal: true,
        },
        dev: {
          optimizeDeps: {
            exclude: ["vite/module-runner"],
          },
        },
      },
    },
    server: {
      watch: null,
    },
    ssr: {
      target: "webworker",
    },
  });
  await server.listen();

  const serverUrl = server.resolvedUrls?.local[0];
  tinyassert(serverUrl);

  // TODO: page.exposeBinding? to handle fetchModule?
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  await page.goto(serverUrl);

  // TODO: redirect console event
  // page.on("console", async (msg) => {
  //   const values = [];
  //   for (const arg of msg.args()) {
  //     values.push(await arg.jsonValue());
  //   }
  //   console.log(...values);
  // });

  // evaluate command via virtual module
  // so that `import` etc... are transformed by vite
  async function evaluate(cmd: string) {
    if (!cmd.includes("return")) {
      cmd = `return ${cmd}`;
    }

    // TODO: invalidate virtual entry after eval
    const entrySource = `export default async () => { ${cmd} }`;
    const entry = "virtual:eval/" + encodeURI(entrySource);

    // use client websocket to communicate
    const clientEnv = server.environments.client;
    const promise = createManualPromise();
    clientEnv.hot.on("browser-cli:response", promise.resolve);
    clientEnv.hot.send("browser-cli:request", { entry });
    try {
      const result = await promise;
      if (typeof result !== "undefined") {
        console.log(result);
      }
    } finally {
      clientEnv.hot.off("browser-cli:response", promise.resolve);
    }
  }

  const replServer = repl.start({
    eval: async (cmd, _context, _filename, callback) => {
      try {
        await evaluate(cmd);
        (callback as any)(null);
      } catch (e) {
        callback(e as Error, null);
      }
    },
  });

  replServer.on("close", async () => {
    await browser.close();
    await server.close();
  });
}

function vitePluginVirtualEval({ extension }: { extension: string }): Plugin {
  return {
    name: vitePluginVirtualEval.name,
    resolveId(source, _importer, _options) {
      if (source.startsWith("virtual:eval/")) {
        // avoid "\0" since it's skipped by `createFilter`
        // including default esbuild transform
        return "_" + source + "." + extension;
      }
      return;
    },
    load(id, _options) {
      if (id.startsWith("_virtual:eval/")) {
        const encoded = id.slice(
          "_virtual:eval/".length,
          -("." + extension).length,
        );
        return decodeURI(encoded);
      }
      return;
    },
  };
}

function vitePluginBrowserRunner(): Plugin {
  let server: ViteDevServer;

  return {
    name: vitePluginBrowserRunner.name,

    // API endpoint for fetchModule
    configureServer(server_) {
      server = server_;

      // use custom (or ssr) environment since
      // client.fetchModule doesn't apply ssrTransform,
      // which is necessary for module runner execution.
      const devEnv = server.environments["custom"];
      tinyassert(devEnv);

      return () => {
        server.middlewares.use(async (req, res, next) => {
          tinyassert(req.url);
          const url = new URL(req.url, "https://any.local");

          // serve html
          if (url.pathname === "/") {
            res.setHeader("content-type", "text/html;charset=utf-8");
            res.end(/* html */ `
              <script type="module">
                const { start } = await import("/src/runner");
                start({
                  root: ${JSON.stringify(server.config.root)}
                });
              </script>
            `);
            return;
          }

          // API endpoint for fetchModule
          if (url.pathname === "/__viteFetchModule") {
            tinyassert(req.method === "POST");
            const stream = nodeStream.Readable.toWeb(req) as ReadableStream;
            const args = JSON.parse(await streamToString(stream));
            const result = await devEnv.fetchModule(...(args as [any, any]));
            if ("code" in result) {
              // TODO: why is it still injected?
              result.code = result.code.replace(
                'const __vite_ssr_import_0__ = await __vite_ssr_import__("module", {"importedNames":["createRequire"]});',
                "const __vite_ssr_import_0__ = { createRequire: () => {} };",
              );
            }
            res.end(JSON.stringify(result));
            return;
          }
          next();
        });
      };
    },
  };
}

async function streamToString(stream: ReadableStream<Uint8Array>) {
  let result = "";
  await stream.pipeThrough(new TextDecoderStream()).pipeTo(
    new WritableStream({
      write(chunk) {
        result += chunk;
      },
    }),
  );
  return result;
}

main();