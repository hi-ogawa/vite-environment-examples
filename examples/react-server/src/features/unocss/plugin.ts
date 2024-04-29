import { debounce, tinyassert } from "@hiogawa/utils";
import vitePluginUnocss, { type UnocssVitePluginAPI } from "@unocss/vite";
import type { PluginOption, ViteDevServer } from "vite";
import { invalidateModuleById } from "../style/plugin";
import { createVirtualPlugin } from "../utils/plugin";

// cf.
// https://github.com/unocss/unocss/tree/47eafba27619ed26579df60fe3fdeb6122b5093c/packages/vite/src/modes/global
// https://github.com/tailwindlabs/tailwindcss/blob/719c0d488378002ff752e8dc7199c843930bb296/packages/%40tailwindcss-vite/src/index.ts

export function vitePluginUnocssReactServer(): PluginOption {
  const ctx = getUnocssContext();

  function onUpdate(server: ViteDevServer) {
    const mod = invalidateModuleById(
      server.environments.client,
      "\0virtual:unocss.css",
    );
    if (mod) {
      server.environments.client.hot.send({
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

  return [
    {
      name: vitePluginUnocssReactServer.name,
      sharedDuringBuild: true,

      // (dev, build) extract tokens by intercepting transform
      transform(code, id, _options) {
        if (ctx.filter(code, id)) {
          ctx.extract(code, id);
        }
      },

      // (dev) hmr
      async configureServer(server) {
        const debounced = debounce(() => onUpdate(server), 50);
        ctx.onInvalidate(debounced);
        ctx.onReload(debounced);
      },
    },
    {
      name: vitePluginUnocssReactServer.name + ":create",
      sharedDuringBuild: true,

      // [feedback] `create` plugin cannot have `transform` together?
      create(environment) {
        if (environment.mode === "dev") {
          // (dev) virtual module directly transformed
          return [
            createVirtualPlugin("unocss.css", async () => {
              await ctx.flushTasks();
              const result = await ctx.uno.generate(ctx.tokens);
              return result.css;
            }),
          ];
        }
        if (environment.mode === "build") {
          // (build) virtual module processed during renderChunk
          let found = false;
          return [
            createVirtualPlugin("unocss.css", async () => {
              found = true;
              return "/* todo: unocss.css */";
            }),
            {
              name: vitePluginUnocssReactServer.name + ":render",
              renderChunk(_code, chunk, _options) {
                if (found) {
                  console.log("[unocss:renderChunk]", chunk.moduleIds);
                }
              },
            },
          ];
        }
        return;
      },
    },
  ];
}

// create DIY plugin by grabbing unocss instance
function getUnocssContext() {
  const plugins = vitePluginUnocss();
  const plugin = plugins.find((p) => p.name === "unocss:api");
  tinyassert(plugin);
  return (plugin.api as UnocssVitePluginAPI).getContext();
}
