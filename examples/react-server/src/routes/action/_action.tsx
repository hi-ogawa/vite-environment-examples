"use server";

// TODO: support `export let ...` and preserve reference;
let count1 = 0;

export function getCount1() {
  return count1;
}

export function changeCount1(formData: FormData) {
  count1 += Number(formData.get("value"));
}
