<script setup lang="ts">
import { Form, useEnhance } from "../../features/server-action/shared";
import { changeCounter, getCounter } from "./_action";
import { useServerCounter } from "./_store";

// TODO: revalidation
const store = useServerCounter();
store.data ??= await getCounter();

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
