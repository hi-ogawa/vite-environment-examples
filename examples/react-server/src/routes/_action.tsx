"use server";

let count = 0;

export function getCounter() {
  return count;
}

export function changeCounter(formData: FormData) {
  count += Number(formData.get("value"));
}
