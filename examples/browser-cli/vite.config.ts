import { tinyassert } from "@hiogawa/utils";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import nodeStream from "node:stream";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [vitePluginBrowserRunner()],
  environments: {
    custom: {
      resolve: {
        noExternal: true,
      },
    },
  },
}));

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
