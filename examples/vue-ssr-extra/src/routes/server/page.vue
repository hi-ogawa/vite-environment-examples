<script setup lang="ts">
import { onMounted, onServerPrefetch } from "vue";
import { useServerCounter } from "./_store";
import { Form, useEnhance } from "../../features/server-action/shared";
import { changeCounter, getCounter } from "./_action";

const store = useServerCounter();

// TODO: suspend?
onServerPrefetch(async () => {
  store.data = await getCounter();
});

onMounted(async () => {
  // TODO: refetch on stale?
  store.data ??= await getCounter();
});

const [formAction, { status }] = useEnhance(changeCounter, {
  onSuccess(data) {
    store.data = data;
  },
});
</script>

<template>
  <Form :action="formAction">
    <div>Server Counter: {{ store.data ?? "..." }}</div>
    <button type="submit" name="delta" value="-1">-1</button>
    <button type="submit" name="delta" value="+1">+1</button>
    <span v-if="status === 'pending'">...</span>
  </Form>
</template>
