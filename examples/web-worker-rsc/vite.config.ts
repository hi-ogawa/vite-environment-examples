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
    },
    worker: {
      webCompatible: true,
      resolve: {
        conditions: ["react-server", "worker"],
        noExternal: true,
      },
      dev: {
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
          ],
        },
      },
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

  return [workerEntryPlugin];
}
