"use server";

import { env } from "../../env";

export async function getCounter() {
  return Number(await env.kv.get("count"));
}

export async function changeCounter(delta: number) {
  let counter = Number(await env.kv.get("count"));
  counter += delta;
  await env.kv.put("count", String(counter));
  return counter;
}
