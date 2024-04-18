import { tinyassert } from "@hiogawa/utils";
import { defineComponent, h, ref, type PropType } from "vue";

export const ACTION_PATH = "/__action";

type FormAction<T = any> = (v: FormData) => Promise<T>;

export type ServerActionPayload = {
  id: string;
  name: string;
  args: unknown[];
};

type ServerActionMetadata = {
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
      type: Function as PropType<FormAction>,
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

// TODO: action return value on progressive enhancement?
export function useEnhance<T>(
  action: FormAction<T>,
  options?: {
    onSuccess: (data: T) => void;
  },
) {
  const meta = action as any as ServerActionMetadata;
  const status = ref<"idle" | "pending" | "success">("idle");
  const enhanced: FormAction<void> = async (v) => {
    status.value = "pending";
    // TODO: what if unmounted before finishing action?
    const result = await action(v);
    options?.onSuccess(result);
    status.value = "success";
  };
  const newAction = registerServerReference(enhanced, meta.__id, meta.__name);
  return [newAction, { status }] as const;
}
