<script setup lang="ts">
import { onMounted, onServerPrefetch } from "vue";
import { useServerCounter } from "./_store";
import { Form } from "../../features/server-action/shared";
import { changeCounter2, getCounter } from "./_action";

const store = useServerCounter();

// TODO: suspend?
onServerPrefetch(async () => {
  store.data = await getCounter();
});

onMounted(async () => {
  // TODO: refetch on stale?
  if (!store.isReady) {
    store.data = await getCounter();
    store.isReady = true;
  }
});
</script>

<template>
  <Form :action="changeCounter2">
    <div>Server Counter: {{ store.isReady ? store.data : "..." }}</div>
    <button name="delta" value="-1">-1</button>
    <button name="delta" value="+1">+1</button>
  </Form>
</template>
