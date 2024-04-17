<script setup lang="ts">
import { onMounted, onServerPrefetch } from "vue";
import { useServerCounter } from "./_store";

const store = useServerCounter();

onServerPrefetch(async () => {
  await store.load();
});

onMounted(async () => {
  await store.load();
});
</script>

<template>
  <div>Server Counter: {{ store.isLoading ? "..." : store.count }}</div>
  <button type="button" @click="store.change(-1)">-1</button>
  <button type="button" @click="store.change(+1)">+1</button>
</template>
