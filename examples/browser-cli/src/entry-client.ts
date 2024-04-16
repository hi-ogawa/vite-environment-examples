import { tinyassert } from "@hiogawa/utils";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

declare let __viteRunnerMeta: {
  root: string;
};

async function main() {
  const runner = new ModuleRunner(
    {
      root: __viteRunnerMeta.root,
      sourcemapInterceptor: false,
      transport: {
        fetchModule: async (...args) => {
          const response = await fetch("/__viteFetchModule", {
            method: "POST",
            body: JSON.stringify(args),
          });
          tinyassert(response.ok);
          const result = response.json();
          return result as any;
        },
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );
  const mod = await runner.import("/package.json");
  console.log(mod);

  tinyassert(import.meta.hot);
  import.meta.hot.on("browser-runner-eval", (data) => {
    data;
  });
}

main();
