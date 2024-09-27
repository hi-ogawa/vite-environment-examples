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
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
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
        rollupOptions: {
          input: {
            index: "/src/entry-worker",
          },
        },
      },
    },
  },

  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments["client"]!);
    },
  },
}));

function vitePluginWorkerRunner(): Plugin[] {
  const workerEntryPlugin: Plugin = {
    name: vitePluginWorkerRunner.name + ":entry",
    transform(_code, id) {
      // rewrite ?worker-runner import
      if (id.endsWith("?worker-runner")) {
        const workerUrl = id.replace("?worker-runner", "?worker-runner-file");
        return `export default ${JSON.stringify(workerUrl)}`;
      }

      // rewrite worker entry to execute it on runner
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
      if (this.environment.name === "worker" && ctx.modules.length > 0) {
        this.environment;
      }
    },
  };

  return [workerEntryPlugin];
}
