<script setup lang="ts">
import { ref, onMounted } from "vue";

const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <h3>Vue example</h3>
  <div style="display: flex; align-items: center; gap: 0.5rem">
    <pre style="margin: 0">(hydrated: {{ hydrated }})</pre>
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
