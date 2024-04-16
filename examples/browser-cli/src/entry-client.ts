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

  tinyassert(import.meta.hot);
  const hot = import.meta.hot;

  hot.on("browser-cli:request", async (data) => {
    console.log(data);
    const mod = await runner.import(data.entry);
    const result = await mod.default();
    hot.send("browser-cli:response", result);
  });
}

main();
