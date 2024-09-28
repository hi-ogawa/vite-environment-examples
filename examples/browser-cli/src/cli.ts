import repl from "node:repl";
import { createManualPromise, tinyassert } from "@hiogawa/utils";
import { chromium } from "@playwright/test";
import {
  type Plugin,
  type PluginOption,
  createServer,
  parseAstAsync,
} from "vite";
import type { FetchFunction, ModuleRunner } from "vite/module-runner";

const headless = !process.env["CLI_HEADED"];
const extension = process.env["CLI_EXTENSION"] ?? "tsx";

async function main() {
  const server = await createServer({
    clearScreen: false,
    appType: "custom",
    plugins: [
      vitePluginVirtualEval({ extension }),
      vitePluginBrowserRunner(),
      vitePluginFetchModuleServer(),
    ],
    optimizeDeps: {
      noDiscovery: true,
    },
    environments: {
      custom: {
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
  });
  await server.listen();

  const serverUrl = server.resolvedUrls?.local[0];
  tinyassert(serverUrl);

  // TODO: page.exposeFunction to handle fetchModule?
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  await page.goto(serverUrl);

  const isReady = createManualPromise<void>();
  page.exposeFunction("__viteRunnerReady", () => isReady.resolve());
  await isReady;

  // evaluate repl input
  async function evaluate(cmd: string) {
    // TODO: invalidate virtual entry after eval
    const entrySource = `export default async () => { ${cmd} }`;
    const entry = "virtual:eval/" + encodeURI(entrySource);

    // run ModuleRunner via page.evaluate as it supports nice serialization
    const result = await page.evaluate(async (entry) => {
      const runner: ModuleRunner = (globalThis as any).__runner;
      try {
        const mod = await runner.import(entry);
        return mod.default();
      } catch (e) {
        return e;
      }
    }, entry);

    console.log(result);
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

function vitePluginVirtualEval({
  extension,
}: {
  extension: string;
}): PluginOption {
  // virtual module for `virtual:eval/(source code)`
  const virtual: Plugin = {
    name: vitePluginVirtualEval.name + ":load",
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
    transform(code, id, options) {
      code;
      id;
      options;
    },
  };

  // inject `return` to last expression statement
  // [input]
  //   export default async () => { 1; 2; 3 }
  // [output]
  //   export default async () => { 1; 2; return 3 }
  const transform: Plugin = {
    name: vitePluginVirtualEval.name + ":transform",
    enforce: "post",
    async transform(code, id, _options) {
      if (id.startsWith("_virtual:eval/")) {
        const ast = await parseAstAsync(code);
        let outCode = code;
        for (const node of ast.body) {
          if (
            node.type === "ExportDefaultDeclaration" &&
            node.declaration.type === "ArrowFunctionExpression" &&
            node.declaration.body.type === "BlockStatement"
          ) {
            const last = node.declaration.body.body.at(-1);
            if (last?.type === "ExpressionStatement") {
              const start = (last as any).start;
              outCode = code.slice(0, start) + "return " + code.slice(start);
            }
          }
        }
        return outCode;
      }
      return;
    },
  };

  return [virtual, transform];
}

function vitePluginBrowserRunner(): Plugin {
  return {
    name: vitePluginBrowserRunner.name,
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          tinyassert(req.url);
          const url = new URL(req.url, "https://any.local");

          // serve html which starts module runner
          if (url.pathname === "/") {
            res.setHeader("content-type", "text/html;charset=utf-8");
            res.end(/* html */ `
              <script type="module">
                const { start } = await import("/src/runner");
                const runner = await start({
                  root: ${JSON.stringify(server.config.root)}
                });
                globalThis.__runner = runner;
                globalThis.__viteRunnerReady();
              </script>
            `);
            return;
          }

          next();
        });
      };
    },
  };
}

// https://github.com/vitejs/vite/discussions/18191
function vitePluginFetchModuleServer(): Plugin {
  return {
    name: vitePluginFetchModuleServer.name,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "https://any.local");
        if (url.pathname === "/@vite/fetchModule") {
          const [name, ...args] = JSON.parse(url.searchParams.get("payload")!);
          const result = await server.environments[name]!.fetchModule(
            ...(args as Parameters<FetchFunction>),
          );
          res.end(JSON.stringify(result));
          return;
        }
        next();
      });
    },
  };
}

main();
