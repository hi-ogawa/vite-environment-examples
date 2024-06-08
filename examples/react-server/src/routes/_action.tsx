"use server";

import { sleep } from "@hiogawa/utils";

let count = 0;

console.log("[imported]", import.meta.url);

export function getCounter() {
  console.log("[getCounter]", { count });
  return count;
}

export function changeCounter(formData: FormData) {
  count += Number(formData.get("value"));
  console.log("[changeCounter]", { count });
}

type CheckAnswerState = {
  message: string;
  answer?: number;
  count: number;
};

export async function checkAnswer(
  prev: CheckAnswerState | null,
  formData: FormData,
) {
  await sleep(500);
  const answer = Number(formData.get("answer"));
  const message = answer === 2 ? "Correct!" : "Wrong!";
  return { message, answer, count: (prev?.count ?? 0) + 1 };
}
