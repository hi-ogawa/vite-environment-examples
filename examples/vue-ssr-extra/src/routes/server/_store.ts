import { defineStore } from "pinia";

// TODO: hook into server action?
import { changeCounter, getCounter } from "./_action";

export const useServerCounter = defineStore("server-counter", {
  state: () => ({ count: 0, isLoading: true }),
  actions: {
    async load() {
      this.count = await getCounter();
      this.isLoading = false;
    },
    async change(delta: number) {
      this.count = await changeCounter(delta);
      this.isLoading = false;
    },
  },
});
