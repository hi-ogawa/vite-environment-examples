<script setup lang="ts">
import { onMounted, onUpdated, ref } from "vue";

const mounted = ref(0);
const updated = ref(0);

onMounted(() => {
  mounted.value++;
});
onUpdated(() => {
  updated.value++;
});

const suspended = ref(false);
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
    <span v-if="suspended">...</span>
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
      <li>
        <span style="display: flex; gap: 0.5rem">
          <RouterLink to="/server">Counter (server)</RouterLink>
          <a href="/server?__nojs">(disable js)</a>
        </span>
      </li>
    </ul>
  </nav>
  <main>
    <RouterView v-slot="{ Component }">
      <Suspense @pending="suspended = true" @resolve="suspended = false">
        <component :is="Component"></component>
      </Suspense>
    </RouterView>
  </main>
</template>
