import { memoize, tinyassert } from "@hiogawa/utils";

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

export function initializeWebpackBrowser() {
  Object.assign(globalThis, {
    __webpack_require__: memoize(importWrapper),
    __webpack_chunk_load__: () => {
      throw new Error("todo: __webpack_chunk_load__");
    },
  });
}
