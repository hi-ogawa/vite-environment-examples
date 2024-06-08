import { fileURLToPath } from "node:url";

const { getThing, myImport } = await import("./src/entry.js");

const thingAbsPath = fileURLToPath(new URL("./src/thing.js", import.meta.url));
const direct = await myImport(thingAbsPath);
console.log(direct.thing === getThing());
