import { fileURLToPath } from "url";
import {
  createServer,
  createNodeEnvironment,
  createServerModuleRunner,
} from "vite";
import { vitePluginEnvironmentOptimizeDeps } from "./vite-plugin-environment-optimize-deps";
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
    }),
    {
      name: "fix-import-jsxDEV",
      apply: "serve",
      transform(code, _id, _options) {
        // import { jsxDEV } from "..."
        //   ⇓
        // import __jsxRuntime from "..."; const { jsxDEV } = __jsxRuntime;
        if (code.startsWith("import { jsxDEV }")) {
          const lines = code.split("\n");
          lines[0] = [
            "import __jsxRuntime",
            lines[0]!.slice("import { jsxDEV }".length),
            "const { jsxDEV } = __jsxRuntime",
          ].join("");
          return lines.join("\n");
        }
        return;
      },
    },
  ],
});

await server.pluginContainer.buildStart({});

const environment = server.environments["custom"];
tinyassert(environment);

// console.log(await environment.transformRequest("/entry"));
// console.log(await server.environments["client"]?.transformRequest("/entry"));

const runner = createServerModuleRunner(environment);
const mod = await runner.import("/entry");
await mod.default();

await server.close();
