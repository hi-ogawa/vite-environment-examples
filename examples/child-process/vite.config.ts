import assert from "node:assert";
import { webToNodeHandler } from "@hiogawa/utils-node";
import react from "@vitejs/plugin-react";
import { defineConfig, isRunnableDevEnvironment } from "vite";
import { ChildProcessFetchDevEnvironment } from "./src/lib/vite/environment";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    {
      name: "app",
      configureServer(server) {
        Object.assign(globalThis, {
          __vite_server__: server,
          __vite_environment_rsc__: server.environments["rsc"],
        });
        return () => {
          server.middlewares.use(
            webToNodeHandler(async (request) => {
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
      // TODO: for now, we need this to avoid mixed condition for ssr/rsc envs
      // https://github.com/vitejs/vite/issues/18222
      webCompatible: true,
      resolve: {
        externalConditions: ["react-server"],
      },
      dev: {
        createEnvironment: ChildProcessFetchDevEnvironment.createFactory({
          runtime: (process.env["CHILD_PROCESS_RUNTIME"] ?? "bun") as any,
          conditions: ["react-server"],
        }),
      },
    },
  },
}));
