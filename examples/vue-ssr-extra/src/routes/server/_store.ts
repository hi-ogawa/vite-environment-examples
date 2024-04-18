import { defineStore } from "pinia";

type CounterState = {
  data: number | null;
};

export const useServerCounter = defineStore("server-counter", {
  state: () => <CounterState>{ data: null },
});
