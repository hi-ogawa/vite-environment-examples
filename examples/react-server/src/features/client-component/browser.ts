import { memoize, tinyassert } from "@hiogawa/utils";

async function importClientRefrence(id: string) {
  if (import.meta.env.DEV) {
    // `__raw_import` injected by examples/react-server/src/features/bootstrap/plugin.ts
    return (globalThis as any).__raw_import(id);
  } else {
    const clientReferences = await import(
      "virtual:client-references" as string
    );
    const dynImport = clientReferences.default[id];
    tinyassert(dynImport, `client reference not found '${id}'`);
    return dynImport();
  }
}

export function initializeReactClientBrowser() {
  Object.assign(globalThis, {
    __webpack_require__: memoize(importClientRefrence),
    __webpack_chunk_load__: () => {
      throw new Error("todo: __webpack_chunk_load__");
    },
  });
}
