import assert from "node:assert";
import childProcess from "node:child_process";
import http from "node:http";
import { join } from "node:path";
import { webToNodeHandler } from "@hiogawa/utils-node";
import react from "@vitejs/plugin-react";
import { DevEnvironment, defineConfig, isRunnableDevEnvironment } from "vite";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    {
      name: "app",
      configureServer(server) {
        Object.assign(globalThis, { __vite_server__: server });
        return () => {
          server.middlewares.use(
            webToNodeHandler(async (request) => {
              if (1) {
                return (server.environments["rsc"] as any).dispatchFetch(
                  "/src/entry-rsc.tsx",
                  request,
                );
              }
              const ssrEnv = server.environments.ssr;
              assert(isRunnableDevEnvironment(ssrEnv));
              const mod = await ssrEnv.runner.import("/src/entry-ssr.tsx");
              return mod.default(request);
            }),
          );
        };
      },
    },
  ],
  environments: {
    rsc: {
      resolve: {
        conditions: ["react-server"],
        externalConditions: ["react-server"],
      },
      dev: {
        // TODO: refactor to factory
        createEnvironment(name, config, _context) {
          // const command = [
          //   "bun",
          //   "run",
          //   "--conditions",
          //   "react-server",
          //   join(import.meta.dirname, "./src/lib/vite/runtime/bun.js"),
          // ];
          const command = [
            "node",
            "--conditions",
            "react-server",
            join(import.meta.dirname, "./src/lib/vite/runtime/node.js"),
          ];

          // TODO
          // can we abstract away child process? FetchBridgeDevEnvironment?
          // multiple children per env (like Vitest)? need different API?
          class ChildProcessFetchDevEnvironment extends DevEnvironment {
            public bridge!: http.Server;
            public bridgeUrl!: string;
            public child!: childProcess.ChildProcess;
            public childUrl!: string;
            public childUrlPromise!: PromiseWithResolvers<string>;

            override init: DevEnvironment["init"] = async (...args) => {
              await super.init(...args);

              const listener = webToNodeHandler(async (request) => {
                const url = new URL(request.url);
                // TODO: other than json?
                if (url.pathname === "/rpc") {
                  const { method, args } = await request.json();
                  assert(method in this);
                  const result = await (this as any)[method]!(...args);
                  return Response.json(result);
                }
                return undefined;
              });

              const bridge = http.createServer((req, res) => {
                listener(req, res, (e) => {
                  console.error(e);
                  res.statusCode = 500;
                  res.end("Internal server error");
                });
              });
              this.bridge = bridge;

              await new Promise<void>((resolve, reject) => {
                bridge.listen(() => {
                  const address = bridge.address();
                  assert(address && typeof address !== "string");
                  this.bridgeUrl = `http://localhost:${address.port}`;
                  resolve();
                });
                bridge.on("error", (e) => {
                  console.error(e);
                  reject(e);
                });
              });

              // TODO: separate child process concern?
              this.childUrlPromise = PromiseWithReoslvers();
              const child = childProcess.spawn(
                command[0]!,
                [
                  ...command.slice(1),
                  JSON.stringify({
                    bridgeUrl: this.bridgeUrl,
                    root: this.config.root,
                  }),
                ],
                {
                  stdio: ["ignore", "inherit", "inherit"],
                },
              );
              this.child = child;
              await new Promise<void>((resolve, reject) => {
                child.on("spawn", () => {
                  resolve();
                });
                child.on("error", (e) => {
                  reject(e);
                });
              });
              this.childUrl = await this.childUrlPromise.promise;
              console.log("[environment.init]", {
                bridgeUrl: this.bridgeUrl,
                childUrl: this.childUrl,
              });
            };

            override close: DevEnvironment["close"] = async (...args) => {
              await super.close(...args);
              this.child?.kill();
              this.bridge?.close();
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
              const childUrl = new URL(this.childUrl);
              url.host = childUrl.host;
              return fetch(new Request(url, { ...request, headers }));
            }

            /** @internal rpc for runner */
            async register(childUrl: string) {
              this.childUrlPromise.resolve(childUrl);
              return true;
            }
          }

          return new ChildProcessFetchDevEnvironment(name, config, {
            // TODO
            hot: false,
          });
        },
      },
    },
  },
}));

function PromiseWithReoslvers<T>(): PromiseWithResolvers<T> {
  let resolve: any;
  let reject: any;
  const promise = new Promise<any>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}
