import { tinyassert } from "@hiogawa/utils";
import { fileURLToPath } from "url";
import {
  createServer,
  createServerModuleRunner,
  createNodeEnvironment,
} from "vite";

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  environments: {
    custom: {
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "custom"),
        optimizeDeps: {
          include: ["react", "react-dom"],
        },
      },
    },
  },
});

const environment = server.environments["custom"];
tinyassert(environment);

const runner = createServerModuleRunner(environment);
const mod = await runner.import("/entry");
mod.default();

await server.close();