import { tinyassert } from "@hiogawa/utils";
import { defineComponent, h } from "vue";

export const ACTION_PATH = "/__action";

export type ServerActionPayload = {
  id: string;
  name: string;
  args: unknown[];
};

export type ServerActionMetadata = {
  __id: string;
  __name: string;
};

export function registerServerReference(
  ref: Function,
  __id: string,
  __name: string,
) {
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
            // e.preventDefault();
            e;
            props.action;
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
