<script setup lang="ts">
import { ref, onMounted } from "vue";

const count = ref(0);
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <div>
    <div>hydrated: {{ hydrated }}</div>
    <div>Count: {{ count }}</div>
    <button type="button" @click="count--">-1</button>
    <button type="button" @click="count++">+1</button>
  </div>
</template>
