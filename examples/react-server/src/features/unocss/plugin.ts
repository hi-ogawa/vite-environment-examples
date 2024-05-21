import { debounce, objectHas, tinyassert } from "@hiogawa/utils";
import vitePluginUnocss, { type UnocssVitePluginAPI } from "unocss/vite";
import { DevEnvironment, type Plugin } from "vite";
import { invalidateModule } from "../style/plugin";
import { createVirtualPlugin } from "../utils/plugin";

// cf.
// https://github.com/unocss/unocss/tree/47eafba27619ed26579df60fe3fdeb6122b5093c/packages/vite/src/modes/global
// https://github.com/tailwindlabs/tailwindcss/blob/719c0d488378002ff752e8dc7199c843930bb296/packages/%40tailwindcss-vite/src/index.ts

export function vitePluginSharedUnocss(): Plugin[] {
  // reuse original plugin to grab internal unocss instance and transform plugins
  const originalPlugins = vitePluginUnocss();
  const apiPlugin = originalPlugins.find((p) => p.name === "unocss:api");
  tinyassert(apiPlugin);
  const ctx = (apiPlugin.api as UnocssVitePluginAPI).getContext();

  // extract tokens by intercepting transform
  const extractPlugin: Plugin = {
    name: vitePluginSharedUnocss.name + ":extract",
    sharedDuringBuild: true,
    transform(code, id) {
      if (ctx.filter(code, id)) {
        ctx.tasks.push(ctx.extract(code, id));
      }
    },
  };

  // In our case, we only need to expose virtual css to "client" environment.
  // However, we don't need such restriction since following plugins kick in
  // only on the environments which actually import "virtual:unocss.css".
  const environmentPlugins: NonNullable<Plugin["environmentPlugins"]> = (
    environment,
  ) => {
    const plugins: Plugin[] = [];

    // reuse transform plugins
    plugins.push(
      ...originalPlugins.filter((plugin) =>
        plugin.name.startsWith("unocss:transformers:"),
      ),
    );

    // [dev]
    // transform virtual module directly and HMR is triggered as more tokens are discovered
    if (environment.mode === "dev") {
      // transform virtual module directly
      plugins.push(
        createVirtualPlugin("unocss.css", async () => {
          await ctx.flushTasks();
          const result = await ctx.uno.generate(ctx.tokens);
          return result.css;
        }),
      );

      // HMR
      function hotUpdate() {
        tinyassert(environment instanceof DevEnvironment);
        const mod = invalidateModule(environment, "\0virtual:unocss.css");
        if (mod) {
          environment.hot.send({
            type: "update",
            updates: [
              {
                type: `${mod.type}-update`,
                path: "/@id/__x00__virtual:unocss.css",
                acceptedPath: "/@id/__x00__virtual:unocss.css",
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
      const debounced = debounce(() => hotUpdate(), 50);
      ctx.onInvalidate(debounced);
      ctx.onReload(debounced);
    }

    // [build]
    // transform virtual module during renderChunk
    if (environment.mode === "build") {
      const cssPlugins = environment.config.plugins.filter(
        (p) => p.name === "vite:css" || p.name === "vite:css-post",
      );

      plugins.push(
        createVirtualPlugin("unocss.css", () => "/*** tmp unocss ***/"),
        {
          name: vitePluginSharedUnocss.name + ":render",
          async renderChunk(_code, chunk, _options) {
            if (chunk.moduleIds.includes("\0virtual:unocss.css")) {
              await ctx.flushTasks();
              let { css } = await ctx.uno.generate(ctx.tokens);
              for (const plugin of cssPlugins) {
                tinyassert(typeof plugin.transform === "function");
                const result = await plugin.transform.apply(this as any, [
                  css,
                  "\0virtual:unocss.css",
                ]);
                tinyassert(
                  objectHas(result, "code") && typeof result.code === "string",
                );
                css = result.code;
              }
            }
          },
        },
      );
    }

    return plugins;
  };

  return [
    {
      name: vitePluginSharedUnocss.name,
      sharedDuringBuild: true,
      // TODO: not working https://github.com/vitejs/vite/pull/16471#discussion_r1607712177
      transform: {
        order: "post",
        handler(code, id) {
          if (ctx.filter(code, id)) {
            ctx.tasks.push(ctx.extract(code, id));
          }
        },
      },
      environmentPlugins,
    },
    extractPlugin,
  ];
}
