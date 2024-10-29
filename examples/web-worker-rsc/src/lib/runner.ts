import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";
import { fetchClientFetchModule } from "./fetch-module-client";

export function createFetchRunner(options: {
  environmentName: string;
}) {
  const runner = new ModuleRunner(
    {
      sourcemapInterceptor: false,
      transport: {
        fetchModule: fetchClientFetchModule(options.environmentName),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );
  return runner;
}
