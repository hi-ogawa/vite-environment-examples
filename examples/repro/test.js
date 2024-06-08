import { fileURLToPath } from "url";
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

const { myImport } = await runner.import("/src/entry");

const mod1 = await runner.import("/src/thing.ts");
console.log("[mod1.thing]", mod1.thing);

const resolved = await environment.moduleGraph.resolveUrl("/src/thing.ts");
const mod2 = await myImport(resolved[1]);
console.log("[mod2.thing]", mod2.thing);

console.log("[mod1.thing === mod2.thing]", mod1.thing === mod2.thing);

await server.close();
