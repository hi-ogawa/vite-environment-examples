import reactServerDomWebpack from "react-server-dom-webpack/server.edge";
import { tinyassert } from "@hiogawa/utils";
import { ejectActionId } from "./utils";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  return reactServerDomWebpack.registerServerReference(action, id, name);
}

export async function serverActionHandler({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionId = ejectActionId(formData);
  const action = await importServerAction(actionId);
  await action(formData);
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
