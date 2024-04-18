import { tinyassert } from "@hiogawa/utils";
import {
  ACTION_PATH,
  registerServerReference,
  type ServerActionPayload,
} from "./shared";

export function createServerReference(id: string, name: string) {
  const action = async (...args: unknown[]) => {
    const payload: ServerActionPayload = {
      id,
      name,
      args,
    };
    const res = await fetch(ACTION_PATH, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
    });
    tinyassert(res.ok);
    const result = await res.json();
    return result;
  };
  return registerServerReference(action, id, name);
}
