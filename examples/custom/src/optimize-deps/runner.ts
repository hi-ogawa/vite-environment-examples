import { tinyassert } from "@hiogawa/utils";
import { fileURLToPath } from "url";
import {
  createServer,
  createServerModuleRunner,
  createNodeDevEnvironment,
} from "vite";

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  environments: {
    custom: {
      dev: {
        createEnvironment: createNodeDevEnvironment,
        optimizeDeps: {
          include: ["react", "react-dom"],
        },
      },
    },
  },
});

const environment = server.environments["custom"];
tinyassert(environment);

const runner = createServerModuleRunner(server, environment);
const mod = await runner.import("/entry");
mod.default();

await server.close();
