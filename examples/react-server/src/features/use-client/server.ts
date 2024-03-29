import { memoize, tinyassert } from "@hiogawa/utils";
import type { ImportManifestEntry, ModuleMap } from "../../types";

async function importWrapper(id: string) {
  if (import.meta.env.DEV) {
    return import(/* @vite-ignore */ id);
  } else {
    const clientReferences = await import("virtual:client-reference" as string);
    const dynImport = clientReferences.default[id];
    tinyassert(dynImport, `client reference not found '${id}'`);
    return dynImport();
  }
}

export function initializeWebpackServer() {
  Object.assign(globalThis, {
    __webpack_require__: memoize(importWrapper),
    __webpack_chunk_load__: () => {
      throw new Error("todo: __webpack_chunk_load__");
    },
  });
}

export function createModuleMap(): ModuleMap {
  return new Proxy(
    {},
    {
      get(_target, id, _receiver) {
        return new Proxy(
          {},
          {
            get(_target, name, _receiver) {
              tinyassert(typeof id === "string");
              tinyassert(typeof name === "string");
              return {
                id,
                name,
                chunks: [],
              } satisfies ImportManifestEntry;
            },
          },
        );
      },
    },
  );
}
