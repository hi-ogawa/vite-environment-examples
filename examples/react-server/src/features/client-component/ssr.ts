import { tinyassert } from "@hiogawa/utils";
import type { ImportManifestEntry, ModuleMap } from "../../types";

// In contrast to old dev ssr, new module runner's dynamic `import`
// with `vite-ignore` joins in a module graph.
// Thus, `invalidateDepTree` by `vitePluginReactServer` will invalidate
// this entire module and `momoize` will get refreshed automatically.
// So, we don't have to manage `ssrImportPromiseCache` like done in
// https://github.com/hi-ogawa/vite-plugins/blob/1c12519065563da60de9f58b946695adcbb50924/packages/react-server/src/features/use-client/server.tsx#L10-L18

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

const cache = new Map<string, unknown>();

export function initializeWebpackServer() {
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
