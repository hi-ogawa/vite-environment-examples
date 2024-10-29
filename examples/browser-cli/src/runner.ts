import {
  ESModulesEvaluator,
  type FetchFunction,
  ModuleRunner,
} from "vite/module-runner";

export async function start() {
  const runner = new ModuleRunner(
    {
      sourcemapInterceptor: false,
      transport: {
        fetchModule: fetchModuleFetchClient("custom"),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

  return runner;
}

// https://github.com/vitejs/vite/discussions/18191
function fetchModuleFetchClient(environmentName: string): FetchFunction {
  return async (...args) => {
    const payload = JSON.stringify([environmentName, ...args]);
    const response = await fetch(
      "/@vite/fetchModule?" + new URLSearchParams({ payload }),
    );
    const result = response.json();
    return result as any;
  };
}
