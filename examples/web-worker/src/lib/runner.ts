import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";
import { fetchClientFetchModule } from "./fetch-module-client";

export function createFetchRunner(options: {
  root: string;
  environmentName: string;
}) {
  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: false,
      transport: {
        invoke: fetchClientFetchModule(options.environmentName),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );
  return runner;
}
