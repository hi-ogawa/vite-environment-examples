import childProcess from "node:child_process";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { DevEnvironment, defineConfig } from "vite";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [
    react(),
    {
      name: "vite-rpc",
      configureServer(server) {
        // TODO: what if middleware mode?
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          // TODO: json only?
          if (url.pathname === "/@vite/rpc") {
            const { environment, method, args } = JSON.parse(
              url.searchParams.get("payload")!,
            );
            // @ts-ignore
            const result = await server.environments[environment]![method]!(
              ...args,
            );
            res.setHeader("content-type", "application/json;charset=utf-8");
            res.end(JSON.stringify(result));
            return;
          }
          next();
        });
      },
    },
  ],
  environments: {
    rsc: {
      dev: {
        createEnvironment(name, config, _context) {
          class ChildProcessDevEnvironment extends DevEnvironment {
            public child?: childProcess.ChildProcess;
            public address?: string;

            override init: DevEnvironment["init"] = async (...args) => {
              await super.init(...args);
              // TODO: how to multiple runners per env? different API?
              const child = childProcess.spawn(
                "node",
                [
                  join(import.meta.dirname, "./src/lib/vite/runtime/node.js"),
                  "",
                ],
                {
                  stdio: ["ignore", "inherit", "inherit"],
                },
              );
              this.child = child;
            };

            override close: DevEnvironment["close"] = async (...args) => {
              await super.close(...args);
              this.child?.kill();
            };

            async dispatchFetch(
              entry: string,
              request: Request,
            ): Promise<Response> {
              const headers = new Headers(request.headers);
              headers.set(
                "x-vite-meta",
                JSON.stringify({ entry, url: request.url }),
              );
              const url = new URL(request.url);
              url.protocol = "http";
              url.host = "localhost:12345";
              return fetch(new Request(url, { ...request, headers }));
            }

            async register() {}
          }

          return new ChildProcessDevEnvironment(name, config, {
            // TODO
            hot: false,
          });
        },
      },
    },
  },
}));
