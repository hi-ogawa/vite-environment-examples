import type { ModuleRunnerTransport } from "vite/module-runner";

export function fetchClientFetchModule(
  environmentName: string,
): ModuleRunnerTransport["invoke"] {
  return async (...args) => {
    const payload = JSON.stringify([environmentName, ...args]);
    const response = await fetch(
      "/@vite/invoke?" + new URLSearchParams({ payload }),
    );
    const result = response.json();
    return result as any;
  };
}
