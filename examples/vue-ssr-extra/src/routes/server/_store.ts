import { defineStore } from "pinia";

export const useServerCounter = defineStore("server-counter", {
  state: () => ({ count: 0 }),
  actions: {
    // TODO: hook into server action?
    async load() {
      this.count = 1234;
    },
    async change(delta: number) {
      this.count += delta;
    },
  },
});
