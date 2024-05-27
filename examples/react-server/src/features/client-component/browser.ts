import { tinyassert } from "@hiogawa/utils";

async function importWrapper(id: string) {
  if (import.meta.env.DEV) {
    // `__raw_import` injected by examples/react-server/src/features/bootstrap/plugin.ts
    return (globalThis as any).__raw_import(id);
  } else {
    const clientReferences = await import("virtual:client-reference" as string);
    const dynImport = clientReferences.default[id];
    tinyassert(dynImport, `client reference not found '${id}'`);
    return dynImport();
  }
}

const cache = new Map<string, unknown>();

export function initializeWebpackBrowser() {
  Object.assign(globalThis, {
    __webpack_require__: (id: string) => {
      console.log("[__webpack_require__]", { id });
      const mod = cache.get(id);
      tinyassert(mod, `invalid client reference '${id}'`);
      return cache.get(id);
    },
    __webpack_chunk_load__: (id: string) => {
      console.log("[__webpack_chunk_load__]", { id });
      if (import.meta.env.DEV) {
        id = id.split("*")[0];
      }
      const promise = importWrapper(id);
      promise.then((v) => cache.set(id, v));
      return promise;
    },
  });
}
