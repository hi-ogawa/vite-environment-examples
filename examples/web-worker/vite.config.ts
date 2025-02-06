import { rmSync } from "node:fs";
import react from "@vitejs/plugin-react";
import MagicString from "magic-string";
import { type Plugin, defineConfig } from "vite";
import { vitePluginFetchModuleServer } from "./src/lib/fetch-module-server";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [
    react(),
    vitePluginWorkerEnvironment(),
    vitePluginFetchModuleServer(),
    rolldownPluginRollupFileUrl(),
  ],
  environments: {
    client: {
      optimizeDeps: {
        exclude: ["vite/module-runner"],
      },
      build: {
        emptyOutDir: false, // preserve worker build
        minify: false,
        sourcemap: true,
      },
    },
    worker: {
      keepProcessEnv: false,
      resolve: {
        conditions: ["module", "worker"],
        noExternal: true,
      },
      optimizeDeps: {
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom/server",
        ],
        esbuildOptions: {
          platform: "browser",
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
        },
      },
    },
  },

  builder: {
    async buildApp(builder) {
      rmSync("dist", { recursive: true, force: true });
      await Promise.all([
        builder.build(builder.environments["client"]!),
        builder.build(builder.environments["worker"]!),
      ]);
    },
  },
}));

export function vitePluginWorkerEnvironment(): Plugin[] {
  // states for build orchestration (not used during dev)
  const workerMap: Record<string, { referenceId?: string; fileName?: string }> =
    {};
  const events = {
    // TODO: does it get stack on build error?
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
            code = `export default ${JSON.stringify("__VITE_WORKER_URL_PLACEHOLDER[" + entry + "]")}`;
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
    // client buildEnd
    async buildEnd() {
      if (this.environment.name === "client") {
        // kick off worker buildStart
        events.clientBuildEnd.resolve();
      }
    },
    // worker buildStart
    async buildStart() {
      if (this.environment.name === "worker") {
        await events.clientBuildEnd.promise;
        for (const [id, meta] of Object.entries(workerMap)) {
          meta.referenceId = this.emitFile({
            type: "chunk",
            id,
          });
        }
      }
    },
    // worker generateBundle
    async generateBundle(_options, bundle) {
      if (this.environment.name === "worker") {
        for (const meta of Object.values(workerMap)) {
          meta.fileName = this.getFileName(meta.referenceId!);
        }
        delete bundle["_noop.js"];
        delete bundle["_noop.js.map"];

        // kick off client renderChunk
        events.workerGenerateBundle.resolve();
      }
    },
    // client renderChunk
    async renderChunk(code) {
      if (this.environment.name === "client") {
        const output = new MagicString(code);
        const matches = code.matchAll(
          /"__VITE_WORKER_URL_PLACEHOLDER\[(.*)\]"/dg,
        );
        for (const match of matches) {
          await events.workerGenerateBundle.promise;
          const entry = JSON.parse(`"${match[1]!}"`);
          const fileName = workerMap[entry]!.fileName;
          const [start, end] = match.indices![0]!;
          output.update(start, end, JSON.stringify("/" + fileName));
        }
        if (output.hasChanged()) {
          return {
            code: output.toString(),
            map: output.generateMap(),
          };
        }
      }
      return;
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

// workaround until https://github.com/rolldown/rolldown/pull/3488
import path from "node:path";
function rolldownPluginRollupFileUrl(): Plugin {
  return {
    name: rolldownPluginRollupFileUrl.name,
    renderChunk: {
      order: "pre",
      handler(code, chunk) {
        if (!code.includes("import.meta.ROLLUP_FILE_URL_")) {
          return;
        }
        const matches = code.matchAll(/import.meta.ROLLUP_FILE_URL_(\w+)/dg);
        const output = new MagicString(code);
        for (const match of matches) {
          const referenceId = match[1]!;
          const assetFileName = this.getFileName(referenceId);
          const relativePath =
            "./" +
            path.relative(
              path.resolve(chunk.fileName, ".."),
              path.resolve(assetFileName),
            );
          const replacement = `new URL(${JSON.stringify(relativePath)}, import.meta.url)`;
          const [start, end] = match.indices![0]!;
          output.update(start, end, replacement);
        }
        if (output.hasChanged()) {
          return {
            code: output.toString(),
            map: output.generateMap({ hires: "boundary" }),
          };
        }
        return;
      },
    },
  };
}
