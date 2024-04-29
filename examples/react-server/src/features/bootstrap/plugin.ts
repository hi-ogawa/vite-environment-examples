import fs from "node:fs";
import { tinyassert, typedBoolean } from "@hiogawa/utils";
import type { Manifest, PluginOption, ViteDevServer } from "vite";
import { $__global } from "../../global";
import { createVirtualPlugin } from "../utils/plugin";
import { VIRTUAL_COPY_SERVER_CSS } from "./css";

export const ENTRY_CLIENT_BOOTSTRAP = "virtual:entry-client-bootstrap";

export interface SsrAssets {
  head: string;
  bootstrapModules: string[];
}

export function vitePluginEntryBootstrap(): PluginOption {
  return [
    createVirtualPlugin(ENTRY_CLIENT_BOOTSTRAP.slice(8), async () => {
      if ($__global.server) {
        // wrapper entry to ensure client entry runs after vite/react inititialization
        return `
          import "${VIRTUAL_COPY_SERVER_CSS}";
          for (let i = 0; !window.__vite_plugin_react_preamble_installed__; i++) {
            await new Promise(resolve => setTimeout(resolve, 10 * (2 ** i)));
          }
          import("/src/entry-client");
        `;
      } else {
        return `
          import "${VIRTUAL_COPY_SERVER_CSS}";
          import "/src/entry-client";
        `;
      }
    }),
    createVirtualPlugin("ssr-assets", async () => {
      let ssrAssets: SsrAssets;
      if ($__global.server) {
        const { head } = await getIndexHtmlTransform($__global.server);
        ssrAssets = {
          head,
          bootstrapModules: ["/@id/__x00__" + ENTRY_CLIENT_BOOTSTRAP],
        };
      } else {
        const manifest: Manifest = JSON.parse(
          await fs.promises.readFile(
            "dist/client/.vite/manifest.json",
            "utf-8",
          ),
        );
        // TODO: split css per-route?
        const css = Object.values(manifest).flatMap((v) => v.css ?? []);
        const entry = manifest[ENTRY_CLIENT_BOOTSTRAP];
        tinyassert(entry);
        // preload only direct dynamic import for client references map
        const js =
          entry.dynamicImports
            ?.map((k) => manifest[k]?.file)
            .filter(typedBoolean) ?? [];
        const head = [
          ...css.map((href) => `<link rel="stylesheet" href="/${href}" />`),
          ...js.map((href) => `<link rel="modulepreload" href="/${href}" />`),
        ].join("\n");
        ssrAssets = {
          head,
          bootstrapModules: [`/${entry.file}`],
        };
      }
      return `export default ${JSON.stringify(ssrAssets)}`;
    }),
  ];
}

async function getIndexHtmlTransform(server: ViteDevServer) {
  const html = await server.transformIndexHtml(
    "/",
    "<html><head></head></html>",
  );
  const match = html.match(/<head>(.*)<\/head>/s);
  tinyassert(match && 1 in match);
  const head = match[1];
  return { head };
}
