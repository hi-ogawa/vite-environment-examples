import { defineComponent, h } from "vue";

export const ACTION_PATH = "/__action";

export type ServerActionPayload = {
  id: string;
  name: string;
  args: unknown[];
};

// TODO: progressive enhancement form?
export const Form = defineComponent(() => {
  return () => h("form");
});
