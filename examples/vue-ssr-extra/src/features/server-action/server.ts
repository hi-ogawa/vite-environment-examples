import { tinyassert } from "@hiogawa/utils";
import { ACTION_PATH, decodeActionRequest } from "./shared";

export async function serverActionHandler({ request }: { request: Request }) {
  const url = new URL(request.url);
  const payload = await decodeActionRequest(request);
  const mod = await importServerReference(payload.id);
  const action = mod[payload.name];
  const result = await action(...payload.args);
  // client side action
  if (url.pathname === ACTION_PATH) {
    return new Response(JSON.stringify(result), {
      headers: {
        "content-type": "application/json",
      },
    });
  }
  // progressive enhancement (redirect to same route)
  return new Response(null, {
    status: 302,
    headers: {
      location: request.url,
    },
  });
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
