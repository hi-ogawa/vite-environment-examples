import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

/**
 *
 * @param {{ root: string, environmentName: string }} options
 * @returns {import("vite/module-runner").ModuleRunner}
 */
export function createFetchRunner(options) {
  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: false,
      transport: {
        fetchModule: fetchClientFetchModule(options.environmentName),
      },
      // TODO
      hmr: false,
    },
    new ESModulesEvaluator(),
  );
  return runner;
}

/**
 *
 * @param {string} environmentName
 * @returns {import("vite").FetchFunction}
 */
function fetchClientFetchModule(environmentName) {
  return async (...args) => {
    const payload = JSON.stringify([environmentName, ...args]);
    const response = await fetch(
      "/@vite/fetchModule?" + new URLSearchParams({ payload }),
    );
    const result = response.json();
    return result;
  };
}
