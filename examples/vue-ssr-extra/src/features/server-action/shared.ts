import { tinyassert } from "@hiogawa/utils";
import { defineComponent, h } from "vue";

export const ACTION_PATH = "/__action";

export type FormAction<T = any> = (v: FormData) => Promise<T>;

export type ServerActionPayload = {
  id: string;
  name: string;
  args: unknown[];
};

export type ServerActionMetadata = {
  __id: string;
  __name: string;
};

export function registerServerReference<T extends object>(
  ref: T,
  __id: string,
  __name: string,
): T {
  return Object.assign(ref, { __id, __name } satisfies ServerActionMetadata);
}

export const Form = defineComponent({
  props: {
    action: {
      type: Function,
      required: true,
    },
  },
  setup: (props, { slots }) => {
    const metadata = props.action as any as ServerActionMetadata;
    tinyassert(metadata.__id);
    tinyassert(metadata.__name);

    return () =>
      h(
        "form",
        {
          method: "POST",
          onSubmit: (e) => {
            e.preventDefault();
            const formData = submitEventToFormData(e);
            props.action(formData);
          },
        },
        [
          h("input", { type: "hidden", name: "__id", value: metadata.__id }),
          h("input", {
            type: "hidden",
            name: "__name",
            value: metadata.__name,
          }),
          slots["default"]?.(),
        ],
      );
  },
});

// https://github.com/facebook/react/blob/b5e5ce8e0a899345dab1ce71c74bc1d1c28c6a0d/packages/react-dom-bindings/src/events/plugins/FormActionEventPlugin.js#L84-L97
function submitEventToFormData(e: SubmitEvent) {
  tinyassert(e.currentTarget instanceof HTMLFormElement);
  const formData = new FormData(e.currentTarget);
  if (
    e.submitter &&
    (e.submitter instanceof HTMLInputElement ||
      e.submitter instanceof HTMLButtonElement)
  ) {
    formData.set(e.submitter.name, e.submitter.value);
  }
  return formData;
}

export function enhanceFormAction<T>(
  action: FormAction<T>,
  options: {
    onSuccess?: (result: T) => void;
  },
): FormAction<void> {
  const meta = action as any as ServerActionMetadata;
  const enhanced: FormAction<void> = async (v) => {
    const result = await action(v);
    options.onSuccess?.(result);
  };
  return registerServerReference(enhanced, meta.__id, meta.__name);
}

export function encodeActionRequest(
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

export async function decodeActionRequest(
  request: Request,
): Promise<ServerActionPayload> {
  const contentType = request.headers.get("content-type");
  tinyassert(contentType);
  if (contentType === "application/json") {
    return request.json();
  } else {
    const formData = await request.formData();
    const id = formData.get("__id");
    const name = formData.get("__name");
    tinyassert(typeof id === "string");
    tinyassert(typeof name === "string");
    return {
      id,
      name,
      args: [formData],
    };
  }
}
