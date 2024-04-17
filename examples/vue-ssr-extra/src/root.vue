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
  <h3>Vue example</h3>
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
        <RouterLink to="/server">Counter (server)</RouterLink>
      </li>
    </ul>
  </nav>
  <main>
    <RouterView />
  </main>
</template>
