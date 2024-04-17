"use server";

let counter = 1234;

// TODO: kv
export async function getCounter() {
  await sleep(500);
  return counter;
}

export async function changeCounter(delta: number) {
  await sleep(500);
  counter += delta;
  return counter;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
