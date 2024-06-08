import { thing } from "./thing.js";

export function getThing() {
  return thing;
}

/**
 * @param {string} id
 */
export function myImport(id) {
  return import(/* @vite-ignore */ id);
}
