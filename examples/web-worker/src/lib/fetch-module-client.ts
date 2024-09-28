import type { FetchFunction } from "vite";

export function fetchClientFetchModule(environmentName: string): FetchFunction {
  return async (...args) => {
    const payload = JSON.stringify([environmentName, ...args]);
    const response = await fetch(
      "/@vite/fetchModule?" + new URLSearchParams({ payload }),
    );
    const result = response.json();
    return result as any;
  };
}
