import { tinyassert } from "@hiogawa/utils";
import ReactServer from "react-server-dom-webpack/server.edge";
import type { BundlerConfig, ImportManifestEntry } from "../../types";

// https://github.com/facebook/react/blob/c8a035036d0f257c514b3628e927dd9dd26e5a09/packages/react-server-dom-webpack/src/ReactFlightWebpackReferences.js#L43

// $$id: /src/components/counter.tsx#Counter
//   ⇕
// id: /src/components/counter.tsx
// name: Counter

export function registerClientReference(id: string, name: string) {
  if (1) {
    return ReactServer.registerClientReference({}, id, name);
  }
  // reuse everything but $$async: true for simplicity
  const reference = ReactServer.registerClientReference({}, id, name);
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(reference),
      $$async: { value: true },
    },
  );
}

export function createBundlerConfig(): BundlerConfig {
  // need to bust cache for each flight render
  // https://github.com/facebook/react/blob/ea6e05912aa43a0bbfbee381752caa1817a41a86/packages/react-server-dom-webpack/src/ReactFlightClientConfigBundlerWebpack.js#L182
  const cacheId = Math.random().toString(36).slice(2);

  return new Proxy(
    {},
    {
      get(_target, $$id, _receiver) {
        tinyassert(typeof $$id === "string");
        let [id, name] = $$id.split("#");
        tinyassert(id);
        tinyassert(name);

        let chunkId = id;
        if (import.meta.env.DEV) {
          chunkId += "*" + cacheId;
        }
        return { id, name, chunks: [chunkId] } satisfies ImportManifestEntry;
      },
    },
  );
}
