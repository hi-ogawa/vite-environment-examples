import fs from "node:fs";
import { tinyassert } from "@hiogawa/utils";
import type { DevEnvironment, Manifest, PluginOption } from "vite";
import type { PluginStateManager } from "../../../vite.config";
import { $__global } from "../../global";
import { ENTRY_BROWSER_BOOTSTRAP } from "../bootstrap/plugin";
import { createVirtualPlugin } from "../utils/plugin";

const VIRTUAL_SSR_CSS = "virtual:ssr-css.css";
export const VIRTUAL_COPY_SERVER_CSS = "virtual:copy-server-css.js";

export function vitePluginServerCss({
  manager,
}: {
  manager: PluginStateManager;
}): PluginOption {
  return [
    //
    // same idea as https://github.com/hi-ogawa/vite-plugins/tree/main/packages/ssr-css
    //
    {
      name: vitePluginServerCss.name + ":invalidate",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === `/@id/__x00__${VIRTUAL_SSR_CSS}`) {
            const env = $__global.server.environments["client"];
            invalidateModule(env, `\0${VIRTUAL_SSR_CSS}?direct`);
            invalidateModule(env, `\0${VIRTUAL_COPY_SERVER_CSS}`);
          }
          next();
        });
      },
      transformIndexHtml: {
        handler: async () => {
          return [
            {
              tag: "link",
              injectTo: "head",
              attrs: {
                rel: "stylesheet",
                href: `/@id/__x00__${VIRTUAL_SSR_CSS}`,
                "data-ssr-css": true,
              },
            },
            {
              tag: "script",
              injectTo: "head",
              attrs: { type: "module" },
              children: /* js */ `
                import { createHotContext } from "/@vite/client";
                const hot = createHotContext("/__clear_ssr_css");
                hot.on("vite:afterUpdate", () => {
                  document
                    .querySelectorAll("[data-ssr-css]")
                    .forEach(node => node.remove());
                });
              `,
            },
          ];
        },
      },
    },
    createVirtualPlugin(VIRTUAL_SSR_CSS.slice(8), async (id) => {
      tinyassert($__global.server);
      tinyassert(id.includes("?direct"));
      return collectStyle($__global.server.environments["client"], [
        ENTRY_BROWSER_BOOTSTRAP,
        // TODO: split css per-route?
        ...manager.clientReferenceMap.keys(),
      ]);
    }),
    //
    // virtual module to copy css imports from server to client
    //
    createVirtualPlugin(VIRTUAL_COPY_SERVER_CSS.slice(8), async () => {
      if ($__global.server) {
        const urls = await collectStyleUrls(
          $__global.server.environments["rsc"],
          // TODO: lazy import is not crawled until it's imported
          ["/src/entry-server"],
        );
        return [
          ...urls.map((url) => `import "${url}"`),
          `if (import.meta.hot) { import.meta.hot.accept() }`,
        ].join("\n");
      } else {
        const manifest: Manifest = JSON.parse(
          await fs.promises.readFile(
            "dist/react-server/.vite/manifest.json",
            "utf-8",
          ),
        );
        // TODO: split css per-route?
        const code = Object.values(manifest)
          .flatMap((v) => v.css ?? [])
          .map((file) => `import "/dist/react-server/${file}"`)
          .join("\n");
        return code;
      }
    }),
  ];
}

export function invalidateModule(server: DevEnvironment, id: string) {
  const mod = server.moduleGraph.getModuleById(id);
  if (mod) {
    server.moduleGraph.invalidateModule(mod);
  }
  return mod;
}

async function collectStyle(server: DevEnvironment, entries: string[]) {
  const urls = await collectStyleUrls(server, entries);
  const codes = await Promise.all(
    urls.map(async (url) => {
      const res = await server.transformRequest(url + "?direct");
      return [`/*** ${url} ***/`, res?.code];
    }),
  );
  return codes.flat().filter(Boolean).join("\n\n");
}

async function collectStyleUrls(
  server: DevEnvironment,
  entries: string[],
): Promise<string[]> {
  const visited = new Set<string>();

  async function traverse(url: string) {
    const [, id] = await server.moduleGraph.resolveUrl(url);
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const mod = server.moduleGraph.getModuleById(id);
    if (!mod) {
      return;
    }
    await Promise.all(
      [...mod.importedModules].map((childMod) => traverse(childMod.url)),
    );
  }

  // ensure vite's import analysis is ready _only_ for top entries to not go too aggresive
  await Promise.all(entries.map((e) => server.transformRequest(e)));

  // traverse
  await Promise.all(entries.map((url) => traverse(url)));

  // filter
  return [...visited].filter((url) => url.match(CSS_LANGS_RE));
}

// cf. https://github.com/vitejs/vite/blob/d6bde8b03d433778aaed62afc2be0630c8131908/packages/vite/src/node/constants.ts#L49C23-L50
const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
