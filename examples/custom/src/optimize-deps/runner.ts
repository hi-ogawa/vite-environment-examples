import { fileURLToPath } from "url";
import { tinyassert } from "@hiogawa/utils";
import { createServer, createServerModuleRunner } from "vite";

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  environments: {
    custom: {
      dev: {
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
