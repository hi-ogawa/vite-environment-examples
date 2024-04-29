import { debounce, objectHas, tinyassert } from "@hiogawa/utils";
import vitePluginUnocss, { type UnocssVitePluginAPI } from "@unocss/vite";
import { DevEnvironment, type Plugin } from "vite";
import { invalidateModuleById } from "../style/plugin";
import { createVirtualPlugin } from "../utils/plugin";

// cf.
// https://github.com/unocss/unocss/tree/47eafba27619ed26579df60fe3fdeb6122b5093c/packages/vite/src/modes/global
// https://github.com/tailwindlabs/tailwindcss/blob/719c0d488378002ff752e8dc7199c843930bb296/packages/%40tailwindcss-vite/src/index.ts

export function vitePluginUnocssReactServer(): Plugin {
  const ctx = getUnocssContext();

  return {
    name: vitePluginUnocssReactServer.name + ":create",
    sharedDuringBuild: true,
    create(environment) {
      const plugins: Plugin[] = [];

      // (dev, build) [all envs]
      // extract tokens by intercepting transform
      plugins.push({
        name: vitePluginUnocssReactServer.name + ":extract",
        transform(code, id) {
          if (ctx.filter(code, id)) {
            ctx.extract(code, id);
          }
        },
      });

      // (dev) [client]
      // HMR
      if (environment.mode === "dev" && environment.name === "client") {
        tinyassert(environment instanceof DevEnvironment);
        const devEnv = environment;
        function hotUpdate() {
          const mod = invalidateModuleById(devEnv, "\0virtual:unocss.css");
          if (mod) {
            devEnv.hot.send({
              type: "update",
              updates: [
                {
                  type: "js-update",
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

      // (dev) [all envs]
      // transform virtual module directly
      if (environment.mode === "dev") {
        plugins.push(
          createVirtualPlugin("unocss.css", async () => {
            await ctx.flushTasks();
            const result = await ctx.uno.generate(ctx.tokens);
            return result.css;
          }),
        );
      }

      // (build) [all envs]
      // transform virtual module during renderChunk
      if (environment.mode === "build") {
        const cssPlugins = environment.config.plugins.filter(
          (p) => p.name === "vite:css" || p.name === "vite:css-post",
        );

        plugins.push(
          createVirtualPlugin("unocss.css", () => "/*** todo: unocss ***/"),
          {
            name: vitePluginUnocssReactServer.name + ":render",
            async renderChunk(_code, chunk, _options) {
              if (chunk.moduleIds.includes("\0virtual:unocss.css")) {
                await ctx.flushTasks();
                let { css } = await ctx.uno.generate(ctx.tokens);
                // [feedback] environment in renderChunk context?
                const pluginCtx = { ...this, environment };
                for (const plugin of cssPlugins) {
                  tinyassert(typeof plugin.transform === "function");
                  const result = await plugin.transform.apply(
                    pluginCtx as any,
                    [css, "\0virtual:unocss.css"],
                  );
                  tinyassert(
                    objectHas(result, "code") &&
                      typeof result.code === "string",
                  );
                  css = result.code;
                }
              }
            },
          },
        );
      }

      return plugins;
    },
  };
}

// create DIY plugin by grabbing unocss instance
function getUnocssContext() {
  const plugins = vitePluginUnocss();
  const plugin = plugins.find((p) => p.name === "unocss:api");
  tinyassert(plugin);
  return (plugin.api as UnocssVitePluginAPI).getContext();
}
