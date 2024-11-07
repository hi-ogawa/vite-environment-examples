import type { ModuleRunnerTransport } from "vite/module-runner";

export function fetchClientFetchModule(
  environmentName: string,
): ModuleRunnerTransport["invoke"] {
  return async (payload) => {
    const data = JSON.stringify([environmentName, payload]);
    const response = await fetch(
      "/@vite/invoke?" + new URLSearchParams({ data }),
    );
    const result = response.json();
    return result as any;
  };
}
