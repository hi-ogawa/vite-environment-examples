import { fileURLToPath } from "node:url";
import { createServer, createServerModuleRunner } from "vite";

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  environments: {
    custom: {},
  },
});

const environment = server.environments.custom;
const runner = createServerModuleRunner(environment);

const { getThing, myImport } = await runner.import("/src/entry.js");

const thingAbsPath = fileURLToPath(new URL("./src/thing.js", import.meta.url));
const direct = await myImport(thingAbsPath);
console.log(direct.thing === getThing());

await server.close();
