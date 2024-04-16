import { tinyassert } from "@hiogawa/utils";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

export async function start(options: { root: string }) {
  const runner = new ModuleRunner(
    {
      root: options.root,
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
    let result;
    try {
      const mod = await runner.import(data.entry);
      result = await mod.default();
    } catch (e) {
      console.error(e);
      result = String(e);
    }
    hot.send("browser-cli:response", result);
  });
}
