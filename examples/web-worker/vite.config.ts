import { rmSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";
import { vitePluginFetchModuleServer } from "./src/lib/fetch-module-server";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [react(), vitePluginWorkerRunner(), vitePluginFetchModuleServer()],
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
      webCompatible: true,
      resolve: {
        conditions: ["worker"],
        noExternal: true,
      },
      dev: {
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
      // extra build to discover worker reference from client
      manager.workerScan = true;
      await builder.build(builder.environments["client"]!);
      rmSync("dist", { recursive: true, force: true });
      manager.workerScan = false;

      await builder.build(builder.environments["worker"]!);
      await builder.build(builder.environments["client"]!);
    },
  },
}));

// plugin needs `sharedDuringBuild: true` to access manager as singleton
const manager = new (class PluginStateManager {
  workerScan = false;
  workerMap: Record<string, { referenceId?: string; fileName?: string }> = {};
})();

export function vitePluginWorkerRunner(): Plugin[] {
  const workerImportPlugin: Plugin = {
    name: vitePluginWorkerRunner.name + ":import",
    sharedDuringBuild: true,
    transform(_code, id) {
      // rewrite ?worker-runner import
      if (id.endsWith("?worker-runner")) {
        const workerUrl = id.replace("?worker-runner", "?worker-runner-file");
        // dev: pass url directly to `new Worker("<id>?worker-runner-file")`
        if (this.environment.mode === "dev") {
          return {
            code: `export default ${JSON.stringify(workerUrl)}`,
            map: null,
          };
        }
        // build
        if (this.environment.mode === "build") {
          const entry = id.replace("?worker-runner", "");
          let code: string;
          if (manager.workerScan) {
            // client -> worker (scan)
            manager.workerMap[entry] = {};
            // import worker as is to collect worker in worker during scan
            code = `
              import ${JSON.stringify(entry)};
              export default "noop";
            `;
          } else if (this.environment.name === "worker") {
            // worker -> worker (build)
            const referenceId = manager.workerMap[entry]!.referenceId;
            code = `export default import.meta.ROLLUP_FILE_URL_${referenceId}`;
          } else if (this.environment.name === "client") {
            // client -> worker (build)
            const fileName = manager.workerMap[entry]!.fileName;
            code = `export default ${JSON.stringify("/" + fileName)}`;
          } else {
            throw new Error("unreachable");
          }
          return { code, map: null };
        }
      }

      // rewrite worker entry to import it from runner
      if (id.endsWith("?worker-runner-file")) {
        console.assert(this.environment.name === "client");
        console.assert(this.environment.mode === "dev");
        const options = {
          root: this.environment.config.root,
          environmentName: "worker",
        };
        const entryId = id.replace("?worker-runner-file", "");
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
    name: vitePluginWorkerRunner.name + ":build",
    applyToEnvironment: (env) => env.mode === "build" && env.name === "worker",
    sharedDuringBuild: true,
    buildStart() {
      for (const [id, meta] of Object.entries(manager.workerMap)) {
        meta.referenceId = this.emitFile({
          type: "chunk",
          id,
        });
      }
    },
    generateBundle(_options, bundle) {
      for (const meta of Object.values(manager.workerMap)) {
        meta.fileName = this.getFileName(meta.referenceId!);
      }
      delete bundle["_noop.js"];
    },
  };

  return [workerImportPlugin, workerBuildPlugin];
}
