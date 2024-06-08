import { fileURLToPath } from "node:url";

const { getThing, myImport } = await import("./src/entry.js");

const thingPath = fileURLToPath(new URL("./src/thing.js", import.meta.url));
const direct = await myImport(thingPath);
console.log(direct.thing === getThing());
