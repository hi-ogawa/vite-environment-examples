import { tinyassert } from "@hiogawa/utils";

async function importClientReference(id: string) {
  if (import.meta.env.DEV) {
    return import(/* @vite-ignore */ id);
  } else {
    const clientReferences = await import("virtual:client-reference" as string);
    const dynImport = clientReferences.default[id];
    tinyassert(dynImport, `client reference not found '${id}'`);
    return dynImport();
  }
}

const cache = new Map<string, unknown>();

export function initializeReactClientSsr() {
  Object.assign(globalThis, {
    __webpack_require__: (id: string) => {
      console.log("[ssr:require]", id);
      const mod = cache.get(id);
      tinyassert(mod, `invalid client reference '${id}'`);
      return cache.get(id);
    },
    __webpack_chunk_load__: (id: string) => {
      console.log("[ssr:preload]", id);
      if (import.meta.env.DEV) {
        id = id.split("*")[0];
      }
      const promise = importClientReference(id);
      promise.then((v) => cache.set(id, v));
      return promise;
    },
  });
}
