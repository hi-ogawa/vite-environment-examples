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
        outDir: "dist/client",
        minify: false,
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
        outDir: "dist/worker",
        minify: false,
        rollupOptions: {
          input: {
            _unused: "data:text/javascript,console.log(`unused`)",
          },
        },
      },
    },
  },

  builder: {
    async buildApp(builder) {
      // extra build to discover worker imports
      // TODO: need to discvoer worker in worker as well
      manager.workerScan = true;
      await builder.build(builder.environments["client"]!);
      manager.workerScan = false;

      await builder.build(builder.environments["worker"]!);
      await builder.build(builder.environments["client"]!);
    },
  },
}));

// plugin needs `sharedDuringBuild: true` to access manager as singleton
const manager = new (class PluginStateManager {
  workerScan = false;
  workerEntries = new Set<string>();
  workerReferenceIdMap = new Map<string, string>();
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
          return `export default ${JSON.stringify(workerUrl)}`;
        }
        // build:
        if (this.environment.mode === "build") {
          if (manager.workerScan) {
            // client -> worker (scan)
            manager.workerEntries.add(id.replace("?worker-runner", ""));
          } else if (this.environment.name === "worker") {
            // worker -> worker (build)
            // TODO
          } else if (this.environment.name === "client") {
            // client -> worker (build)
            // TODO
          }
        }
        return `export default "todo-build"`;
      }

      // rewrite worker entry to import it from runner
      if (id.endsWith("?worker-runner-file")) {
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
    apply: "build",
    sharedDuringBuild: true,
    buildStart() {
      if (this.environment.name === "worker") {
        for (const entry of manager.workerEntries) {
          const referenceId = this.emitFile({
            type: "chunk",
            id: entry,
          });
          manager.workerReferenceIdMap.set(entry, referenceId);
        }
      }
    },
  };

  return [workerImportPlugin, workerBuildPlugin];
}
