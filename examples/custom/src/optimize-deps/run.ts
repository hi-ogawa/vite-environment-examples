import { fileURLToPath } from "url";
import {
  createServer,
  createNodeEnvironment,
  createServerModuleRunner,
} from "vite";
import { vitePluginEnvironmentOptimizeDeps } from "./vite-plugin-environment-optimize-deps"
import { tinyassert } from "@hiogawa/utils";

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  environments: {
    custom: {
      resolve: {
        conditions: ["react-server"],
      },
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "custom"),
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-server-dom-webpack/server.edge",
          ],
        },
      },
    },
  },
  plugins: [
    vitePluginEnvironmentOptimizeDeps({
      name: "custom",
      // force: true,
    })
  ],
});

await server.pluginContainer.buildStart({})

const environment = server.environments["custom"];
tinyassert(environment);

const runner = createServerModuleRunner(environment);
const mod = await runner.import("/entry");
await mod.default();

await server.close();
