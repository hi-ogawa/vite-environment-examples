"use server";

import { sleep } from "@hiogawa/utils";

let count = 0;

export function getCounter() {
  return count;
}

export function changeCounter(formData: FormData) {
  count += Number(formData.get("value"));
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
