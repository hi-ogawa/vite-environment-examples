import { defineStore } from "pinia";
import { changeCounter } from "./_action";

type CounterState = {
  data: number;
  isReady: boolean;
};

export const useServerCounter = defineStore("server-counter", {
  state: () => <CounterState>{ data: 0, isReady: false },
  actions: {
    async change(delta: number) {
      this.data = await changeCounter(delta);
    },
  },
});
