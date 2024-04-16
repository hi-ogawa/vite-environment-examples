import { createServer, type Plugin, type ViteDevServer } from "vite";
import repl from "node:repl";
import { createManualPromise, tinyassert } from "@hiogawa/utils";
import nodeStream from "node:stream";

async function main() {
  const server = await createServer({
    plugins: [vitePluginVirtualEval(), vitePluginBrowserRunner()],
    environments: {
      custom: {
        resolve: {
          noExternal: true,
        },
      },
    },
  });
  await server.listen();

  // TODO: use browser driver (playwright? webdriverio?)
  //       to communicate with client
  server.printUrls();
  server.resolvedUrls;

  // evaluate command via virtual module
  // so that `import` etc... are transformed by vite
  async function evaluate(cmd: string) {
    if (!cmd.includes("return")) {
      cmd = `return ${cmd}`;
    }
    // TODO: we can invalidate virtual entry after eval
    const entrySource = `export default async () => { ${cmd} }`;
    const entry = "virtual:eval/" + encodeURI(entrySource);

    // use client websocket to communicate
    const clientEnv = server.environments.client;
    const promise = createManualPromise();
    clientEnv.hot.on("browser-cli:response", promise.resolve);
    clientEnv.hot.send("browser-cli:request", { entry });
    try {
      const result = await promise;
      console.log(result);
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

  replServer.on("close", () => {
    server.close();
  });
}

function vitePluginVirtualEval(): Plugin {
  return {
    name: vitePluginVirtualEval.name,
    resolveId(source, _importer, _options) {
      if (source.startsWith("virtual:eval/")) {
        return "\0" + source;
      }
      return;
    },
    load(id, _options) {
      if (id.startsWith("\0virtual:eval/")) {
        const cmd = id.slice("\0virtual:eval/".length);
        return decodeURI(cmd);
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
          if (url.pathname === "/__viteFetchModule") {
            tinyassert(req.method === "POST");
            const stream = nodeStream.Readable.toWeb(req) as ReadableStream;
            const args = JSON.parse(await streamToString(stream));
            const result = await devEnv.fetchModule(...(args as [any, any]));
            res.end(JSON.stringify(result));
          } else {
            next();
          }
        });
      };
    },

    // inject globals to pass runner options
    transformIndexHtml() {
      return [
        {
          tag: "script",
          injectTo: "head",
          attrs: { type: "module" },
          children: /* js */ `
            globalThis.__viteRunnerMeta = {
              root: ${JSON.stringify(server.config.root)}
            };
          `,
        },
      ];
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
