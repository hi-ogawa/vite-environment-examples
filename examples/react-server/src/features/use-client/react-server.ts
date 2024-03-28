import { tinyassert } from "@hiogawa/utils";
import type { BundlerConfig, ImportManifestEntry } from "../../types";

// $$id: /src/components/counter.tsx::Counter
//   ⇕
// id: /src/components/counter.tsx
// name: Counter

const REFERENCE_SEP = "::";

export function createClientReference(id: string, name: string) {
  return Object.defineProperties(() => {}, {
    $$typeof: {
      value: Symbol.for("react.client.reference"),
      enumerable: true,
    },
    $$id: {
      value: [id, name].join(REFERENCE_SEP),
      enumerable: true,
    },
    $$async: {
      value: true,
      enumerable: true,
    },
  }) as any;
}

export function createBundlerConfig(): BundlerConfig {
  return new Proxy(
    {},
    {
      get(_target, $$id, _receiver) {
        tinyassert(typeof $$id === "string");
        let [id, name] = $$id.split("::");
        tinyassert(id);
        tinyassert(name);
        return { id, name, chunks: [] } satisfies ImportManifestEntry;
      },
    },
  );
}
