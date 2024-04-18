"use server";

import { env } from "../../env";

// TODO: request context?

export async function getCounter() {
  return Number(await env.kv.get("count"));
}

export async function changeCounter(delta: number) {
  let counter = Number(await env.kv.get("count"));
  counter += delta;
  await env.kv.put("count", String(counter));
  return counter;
}

export async function changeCounter2(formData: FormData) {
  const delta = Number(formData.get("delta"));
  let counter = Number(await env.kv.get("count"));
  counter += delta;
  await env.kv.put("count", String(counter));
  return counter;
}
