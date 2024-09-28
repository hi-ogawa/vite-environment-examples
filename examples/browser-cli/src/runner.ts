import {
  ESModulesEvaluator,
  type FetchFunction,
  ModuleRunner,
} from "vite/module-runner";

export async function start(options: { root: string }) {
  const runner = new ModuleRunner(
    {
      root: options.root,
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
