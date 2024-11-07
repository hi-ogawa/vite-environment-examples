import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";
import { fetchClientFetchModule } from "../../web-worker/src/lib/fetch-module-client";

export async function start(options: { root: string }) {
  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: false,
      transport: {
        invoke: fetchClientFetchModule("custom"),
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

  return runner;
}
