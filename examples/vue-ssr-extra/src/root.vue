<script setup lang="ts">
import { ref, onMounted, onUpdated } from "vue";

const mounted = ref(0);
const updated = ref(0);

onMounted(() => {
  mounted.value++;
});
onUpdated(() => {
  updated.value++;
});
</script>

<template>
  <div style="display: flex; align-items: baseline; gap: 1rem">
    <h3 style="margin: 1rem 0">Vue example</h3>
    <a
      href="https://github.com/hi-ogawa/vite-environment-examples/tree/main/examples/vue-ssr-extra"
      target="_blank"
    >
      GitHub
    </a>
  </div>
  <div style="display: flex; align-items: center; gap: 0.5rem">
    mounted: {{ mounted }}, updated: {{ mounted }}
    <input placeholder="(test)" />
  </div>
  <nav>
    <ul>
      <li>
        <RouterLink to="/">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/client">Counter (client)</RouterLink>
      </li>
      <li style="display: flex; gap: 0.5rem">
        <RouterLink to="/server">Counter (server)</RouterLink>
        <a href="/server?__nojs">(disable js)</a>
      </li>
    </ul>
  </nav>
  <main>
    <RouterView />
  </main>
</template>
