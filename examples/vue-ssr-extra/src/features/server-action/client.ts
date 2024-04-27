import { tinyassert } from "@hiogawa/utils";
import {
  ACTION_PATH,
  type ServerActionPayload,
  registerServerReference,
} from "./shared";

export function createServerReference(id: string, name: string) {
  const action = async (...args: unknown[]) => {
    const res = await fetch(ACTION_PATH, {
      method: "POST",
      ...encodeActionPayload(id, name, args),
    });
    tinyassert(res.ok);
    const result = await res.json();
    return result;
  };
  return registerServerReference(action, id, name);
}

function encodeActionPayload(
  id: string,
  name: string,
  args: unknown[],
): RequestInit {
  if (args.length === 1 && args[0] instanceof FormData) {
    return {
      body: args[0],
    };
  } else {
    return {
      body: JSON.stringify({ id, name, args } satisfies ServerActionPayload),
      headers: {
        "content-type": "application/json",
      },
    };
  }
}
