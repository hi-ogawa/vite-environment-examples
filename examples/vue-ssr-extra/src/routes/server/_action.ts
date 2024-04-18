"use server";

import { sleep } from "@hiogawa/utils";
import { env } from "../../env";

export async function getCounter() {
  await slowMo();
  return Number(await env.kv.get("count"));
}

export async function changeCounter(formData: FormData) {
  await slowMo();
  const delta = Number(formData.get("delta"));
  let counter = Number(await env.kv.get("count"));
  counter += delta;
  await env.kv.put("count", String(counter));
  return counter;
}

async function slowMo() {
  if (Number.isSafeInteger(env.SLOW_MO)) {
    await sleep(env.SLOW_MO);
  }
}
