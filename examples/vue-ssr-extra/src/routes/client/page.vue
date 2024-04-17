<script setup lang="ts">
import { ref } from "vue";
const count = ref(0);
</script>

<template>
  <div>Count: {{ count }}</div>
  <button type="button" @click="count--">-1</button>
  <button type="button" @click="count++">+1</button>
</template>
