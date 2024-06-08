import { memoize, tinyassert } from "@hiogawa/utils";
import ReactServer from "react-server-dom-webpack/server.edge";
import type { BundlerConfig, ImportManifestEntry } from "../../types";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  if (typeof action !== "function") {
    return action;
  }
  return ReactServer.registerServerReference(action, id, name);
}

export async function serverActionHandler({ request }: { request: Request }) {
  initializeReactServer();
  if (import.meta.env.DEV) {
    serverReferenceImportPromiseCache.clear();
  }

  const url = new URL(request.url);
  let boundAction: Function;
  if (url.searchParams.has("__stream")) {
    // client stream request
    const contentType = request.headers.get("content-type");
    const body = contentType?.startsWith("multipart/form-data")
      ? await request.formData()
      : await request.text();
    const args = await ReactServer.decodeReply(body);
    const actionId = url.searchParams.get("__action_id");
    tinyassert(actionId);
    const action = await importServerAction(actionId);
    boundAction = () => action(...args);
  } else {
    // progressive enhancement
    const formData = await request.formData();
    const decodedAction = await ReactServer.decodeAction(
      formData,
      createActionBundlerConfig(),
    );
    boundAction = async () => {
      const result = await decodedAction();
      const formState = await ReactServer.decodeFormState(result, formData);
      return formState;
    };
  }
  return boundAction();
}

async function importServerReference(id: string): Promise<unknown> {
  console.log("[importServerReference]", id);
  if (import.meta.env.DEV) {
    return import(/* @vite-ignore */ id);
  } else {
    const references = await import("virtual:server-references" as string);
    const dynImport = references.default[id];
    tinyassert(dynImport, `server reference not found '${id}'`);
    return dynImport();
  }
}

async function importServerAction(id: string): Promise<Function> {
  const [file, name] = id.split("#") as [string, string];
  const mod: any = await importServerReference(file);
  return mod[name];
}

function createActionBundlerConfig(): BundlerConfig {
  return new Proxy(
    {},
    {
      get(_target, $$id, _receiver) {
        tinyassert(typeof $$id === "string");
        let [id, name] = $$id.split("#");
        tinyassert(id);
        tinyassert(name);
        return {
          id,
          name,
          chunks: [],
        } satisfies ImportManifestEntry;
      },
    },
  );
}

// maybe this is also not necessary anymore
// (see examples/react-server/src/features/client-component/server.ts)
const serverReferenceImportPromiseCache = new Map<string, Promise<unknown>>();

const serverReferenceWebpackRequire = memoize(importServerReference, {
  cache: serverReferenceImportPromiseCache,
});

function initializeReactServer() {
  Object.assign(globalThis, {
    __vite_react_server_webpack_require__: serverReferenceWebpackRequire,
    __vite_react_server_webpack_chunk_load__: () => {
      throw new Error("todo: __webpack_chunk_load__");
    },
  });
}
