import { tinyassert } from "@hiogawa/utils";
import type { ServerActionPayload } from "./shared";
import { ACTION_PATH } from "./shared";

export async function serverActionHandler({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (url.pathname === ACTION_PATH) {
    const payload: ServerActionPayload = await request.json();
    const mod = await importServerReference(payload.id);
    const action = mod[payload.name];
    const result = await action(...payload.args);
    return new Response(JSON.stringify(result), {
      headers: {
        "content-type": "application/json",
      },
    });
  }
  return new Response(null, { status: 404 });
}

async function importServerReference(id: string) {
  if (import.meta.env.DEV) {
    return import(/* @vite-ignore */ id);
  } else {
    const mod = await import("virtual:server-references" as string);
    const importReference = mod.default[id];
    tinyassert(importReference, `not found server reference: '${id}'`);
    return importReference();
  }
}
