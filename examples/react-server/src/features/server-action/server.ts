import { tinyassert } from "@hiogawa/utils";
import reactServerDomWebpack from "react-server-dom-webpack/server.edge";
import { createBundlerConfig } from "../client-component/server";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  return reactServerDomWebpack.registerServerReference(action, id, name);
}

export async function serverActionHandler({ request }: { request: Request }) {
  initializeReactServer();

  const url = new URL(request.url);
  let boundAction: Function;
  if (url.searchParams.has("__stream")) {
    // client stream request
    const contentType = request.headers.get("content-type");
    const body = contentType?.startsWith("multipart/form-data")
      ? await request.formData()
      : await request.text();
    const args = await reactServerDomWebpack.decodeReply(body);
    const actionId = url.searchParams.get("__action_id");
    tinyassert(actionId);
    const action = await importServerAction(actionId);
    boundAction = () => action(...args);
  } else {
    // progressive enhancement
    const formData = await request.formData();
    const decodedAction = await reactServerDomWebpack.decodeAction(
      formData,
      createBundlerConfig(),
    );
    boundAction = async () => {
      const result = await decodedAction();
      const formState = await reactServerDomWebpack.decodeFormState(
        result,
        formData,
      );
      return formState;
    };
  }
  return boundAction();
}

async function importServerReference(id: string): Promise<unknown> {
  if (import.meta.env.DEV) {
    return import(/* @vite-ignore */ id);
  } else {
    const references = await import("virtual:server-reference" as string);
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

const cache = new Map<string, unknown>();

export function initializeReactServer() {
  Object.assign(globalThis, {
    __vite_react_server_webpack_require__: (id: string) => {
      console.log("[server:require]", id);
      const mod = cache.get(id);
      tinyassert(mod, `invalid server reference '${id}'`);
      return cache.get(id);
    },
    __vite_react_server_webpack_chunk_load__: (id: string) => {
      console.log("[server:preload]", id);
      if (import.meta.env.DEV) {
        id = id.split("*")[0];
      }
      const promise = importServerReference(id);
      promise.then((v) => cache.set(id, v));
      return promise;
    },
  });
}
