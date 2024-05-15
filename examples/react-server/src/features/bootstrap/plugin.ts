import fs from "node:fs";
import { tinyassert, typedBoolean } from "@hiogawa/utils";
import type { Manifest, PluginOption, ViteDevServer } from "vite";
import { $__global } from "../../global";
import { VIRTUAL_COPY_SERVER_CSS } from "../style/plugin";
import { createVirtualPlugin } from "../utils/plugin";

export const ENTRY_BROWSER_BOOTSTRAP = "virtual:entry-client-bootstrap";

export interface SsrAssets {
  head: string;
  bootstrapModules: string[];
}

export function vitePluginEntryBootstrap(): PluginOption {
  return [
    createVirtualPlugin(ENTRY_BROWSER_BOOTSTRAP.slice(8), async () => {
      if ($__global.server) {
        // wrapper entry to ensure client entry runs after vite/react inititialization
        return `
          import "${VIRTUAL_COPY_SERVER_CSS}";
          for (let i = 0; !window.__vite_plugin_react_preamble_installed__; i++) {
            await new Promise(resolve => setTimeout(resolve, 10 * (2 ** i)));
          }
          import("/src/entry-browser");
        `;
      } else {
        return `
          import "${VIRTUAL_COPY_SERVER_CSS}";
          import "/src/entry-browser";
        `;
      }
    }),
    createVirtualPlugin("ssr-assets", async () => {
      let ssrAssets: SsrAssets;
      if ($__global.server) {
        let { head } = await getIndexHtmlTransform($__global.server);
        // expose raw dynamic `import` to avoid vite's import analysis `?import` injection
        // when vite transforms `import(/* @vite-ignore */ id)`..
        // see examples/react-server/src/features/use-client/browser.ts
        head += `<script>globalThis.__raw_import = (id) => import(id)</script>\n`;
        ssrAssets = {
          head,
          bootstrapModules: ["/@id/__x00__" + ENTRY_BROWSER_BOOTSTRAP],
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
        const entry = manifest[ENTRY_BROWSER_BOOTSTRAP];
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
