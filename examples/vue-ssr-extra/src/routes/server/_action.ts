"use server";

import { env } from "../../env";

// TODO: request context?

export async function getCounter() {
  return Number(await env.kv.get("count"));
}

export async function changeCounter(formData: FormData) {
  const delta = Number(formData.get("delta"));
  let counter = Number(await env.kv.get("count"));
  counter += delta;
  await env.kv.put("count", String(counter));
  return counter;
}
