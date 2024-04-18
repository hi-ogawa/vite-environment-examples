import { defineComponent, h } from "vue";

export const ACTION_PATH = "/__action";

export type ServerActionPayload = {
  id: string;
  name: string;
  args: unknown[];
};

// TODO: progressive enhancement form?
export const Form = defineComponent({
  props: {
    action: Function,
  },
  setup: (props, { slots }) => {
    slots;
    props;
    // action_id
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
          h("input", { type: "hidden", name: "__action_id", value: "foo" }),
          h("input", { type: "hidden", name: "__action_name", value: "hey" }),
          slots["default"]?.(),
        ],
      );
  },
});
