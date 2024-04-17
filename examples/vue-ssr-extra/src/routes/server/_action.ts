"use server";

let counter = 1234;

export async function getCounter() {
  return counter;
}

export async function changeCounter(delta: number) {
  counter += delta;
  return counter;
}
