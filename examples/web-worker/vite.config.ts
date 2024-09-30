import { rmSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";
import { vitePluginFetchModuleServer } from "./src/lib/fetch-module-server";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [
    react(),
    vitePluginWorkerEnvironment(),
    vitePluginFetchModuleServer(),
  ],
  environments: {
    client: {
      dev: {
        optimizeDeps: {
          exclude: ["vite/module-runner"],
        },
      },
      build: {
        emptyOutDir: false, // preserve worker build
        minify: false,
        sourcemap: true,
      },
    },
    worker: {
      // consumer: "client", // TODO: is this desired? this would require explicitly setting `moduleRunnerTransform: true` etc...
      webCompatible: true,
      resolve: {
        conditions: ["worker"],
        noExternal: true,
      },
      dev: {
        // moduleRunnerTransform: true,
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/server",
          ],
        },
      },
      build: {
        assetsDir: "_worker",
        emptyOutDir: false,
        minify: false,
        sourcemap: true,
        rollupOptions: {
          input: {
            // emit actual worker entries during `buildStart`
            _noop: "data:text/javascript,console.log()",
          },
          output: {
            // force false since vite enables it when `consumer: "server"` and `webCompatible: true`
            // https://github.com/vitejs/vite/blob/95020ab49e12d143262859e095025cf02423c1d9/packages/vite/src/node/build.ts#L761-L766
            inlineDynamicImports: false,
          },
        },
      },
    },
  },

  builder: {
    async buildApp(builder) {
      rmSync("dist", { recursive: true, force: true });
      await Promise.all([
        builder.build(builder.environments["worker"]!),
        builder.build(builder.environments["client"]!),
      ]);
    },
  },
}));

export function vitePluginWorkerEnvironment(): Plugin[] {
  const workerMap: Record<string, { referenceId?: string; fileName?: string }> =
    {};

  const events = {
    clientBuildEnd: PromiseWithReoslvers<void>(),
    workerGenerateBundle: PromiseWithReoslvers<void>(),
  };

  const workerImportPlugin: Plugin = {
    name: vitePluginWorkerEnvironment.name + ":import",
    sharedDuringBuild: true,
    async transform(_code, id) {
      // rewrite ?worker-env import
      if (id.endsWith("?worker-env")) {
        const workerUrl = id.replace("?worker-env", "?worker-env-file");
        // dev: pass url directly to `new Worker("<id>?worker-env-file")`
        if (this.environment.mode === "dev") {
          return {
            code: `export default ${JSON.stringify(workerUrl)}`,
            map: null,
          };
        }
        // build
        if (this.environment.mode === "build") {
          const entry = id.replace("?worker-env", "");
          let code: string;
          if (this.environment.name === "client") {
            // client -> worker (build)
            // track worker entry and delay worker url replacement until renderChunk.
            workerMap[entry] = {};
            code = `export default __VITE_GET_WORKER_FILE_NAME(${JSON.stringify(entry)})`;
          } else if (this.environment.name === "worker") {
            // worker -> worker (build)
            if (!(entry in workerMap)) {
              workerMap[entry] = {
                referenceId: this.emitFile({
                  type: "chunk",
                  id: entry,
                }),
              };
            }
            const referenceId = workerMap[entry]!.referenceId;
            code = `export default import.meta.ROLLUP_FILE_URL_${referenceId}`;
          } else {
            throw new Error(
              `worker in unknown environment: '${this.environment.name}'`,
            );
          }
          return { code, map: null };
        }
      }

      // rewrite worker entry to import it from runner (dev only)
      if (id.endsWith("?worker-env-file")) {
        console.assert(this.environment.name === "client");
        console.assert(this.environment.mode === "dev");
        const options = {
          root: this.environment.config.root,
          environmentName: "worker",
        };
        const entryId = id.replace("?worker-env-file", "");
        const output = `
          import { createFetchRunner } from "/src/lib/runner";
          const runner = createFetchRunner(${JSON.stringify(options)});
          runner.import(${JSON.stringify(entryId)});
        `;
        return { code: output };
      }
      return;
    },
    hotUpdate(ctx) {
      // full reload browser on worker code change
      if (this.environment.name === "worker" && ctx.modules.length > 0) {
        ctx.server.ws.send({ type: "full-reload", path: ctx.file });
      }
    },
  };

  const workerBuildPlugin: Plugin = {
    name: vitePluginWorkerEnvironment.name + ":build",
    apply: "build",
    sharedDuringBuild: true,
    async buildEnd() {
      if (this.environment.name === "client") {
        events.clientBuildEnd.resolve();
      }
    },
    async buildStart() {
      if (this.environment.name === "worker") {
        // wait until client buildEnd to collect worker reference from client
        await events.clientBuildEnd.promise;
        for (const [id, meta] of Object.entries(workerMap)) {
          meta.referenceId = this.emitFile({
            type: "chunk",
            id,
          });
        }
      }
    },
    async generateBundle(_options, bundle) {
      if (this.environment.name === "worker") {
        delete bundle["_noop.js"];
        delete bundle["_noop.js.map"];
        events.workerGenerateBundle.resolve();
      }
    },
    async renderChunk() {
      if (this.environment.name === "client") {
        await events.workerGenerateBundle.promise;
        // TODO
      }
    },
  };

  return [workerImportPlugin, workerBuildPlugin];
}

function PromiseWithReoslvers<T>(): PromiseWithResolvers<T> {
  let resolve: any;
  let reject: any;
  const promise = new Promise<any>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}
