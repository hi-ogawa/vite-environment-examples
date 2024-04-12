import { tinyassert } from "@hiogawa/utils";

// uniformly handle simple use cases of form action
// both for progressive enhancement and for client-side request
// without using encodeReply/decodeReply/decodeAction API
const ACTION_ID_PREFIX = "$ACTION_ID_";

export function injectActionId(formData: FormData, id: string) {
  formData.set(ACTION_ID_PREFIX + id, "");
}

export function ejectActionId(formData: FormData) {
  let id: string | undefined;
  formData.forEach((_v, k) => {
    if (k.startsWith(ACTION_ID_PREFIX)) {
      id = k.slice(ACTION_ID_PREFIX.length);
      formData.delete(k);
    }
  });
  tinyassert(id);
  return id;
}
