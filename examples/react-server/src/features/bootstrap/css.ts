import type { DevEnvironment, PluginOption } from "vite";
import { $__global } from "../../global";
import { createVirtualPlugin } from "../utils/plugin";

//
// environment api port of
// https://github.com/hi-ogawa/vite-plugins/tree/main/packages/ssr-css
//

export const SSR_CSS_ENTRY = "virtual:ssr-css.css";

export function vitePluginSsrCss(): PluginOption {
  return [
    {
      name: vitePluginSsrCss.name + ":invalidate",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === `/@id/__x00__${SSR_CSS_ENTRY}`) {
            const { moduleGraph } = $__global.server.environments["client"];
            const mod = moduleGraph.getModuleById(`\0${SSR_CSS_ENTRY}?direct`);
            if (mod) {
              moduleGraph.invalidateModule(mod);
            }
          }
          next();
        });
      },
    },
    createVirtualPlugin("ssr-css.css?direct", async () => {
      // collect css in react-server module graph, but evaluate css in client
      const clientEnv = $__global.server.environments["client"];
      const reactServerEnv = $__global.server.environments["react-server"];
      const styles = await Promise.all([
        `/****** react-server ********/`,
        collectStyle(clientEnv, reactServerEnv, ["/src/entry-react-server"]),
        `/****** client **************/`,
        // TODO: use client references as entries
        collectStyle(clientEnv, clientEnv, ["/src/entry-client"]),
      ]);
      return styles.join("\n\n");
    }),
  ];
}

async function collectStyle(
  cssEnv: DevEnvironment,
  moduleEnv: DevEnvironment,
  entries: string[],
) {
  const urls = await collectStyleUrls(moduleEnv, entries);
  const codes = await Promise.all(
    urls.map(async (url) => {
      const res = await cssEnv.transformRequest(url + "?direct");
      return [`/*** ${url} ***/`, res?.code];
    }),
  );
  return codes.flat().filter(Boolean).join("\n\n");
}

async function collectStyleUrls(
  devEnv: DevEnvironment,
  entries: string[],
): Promise<string[]> {
  const visited = new Set<string>();

  async function traverse(url: string) {
    const [, id] = await devEnv.moduleGraph.resolveUrl(url);
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const mod = devEnv.moduleGraph.getModuleById(id);
    if (!mod) {
      return;
    }
    await Promise.all(
      [...mod.importedModules].map((childMod) => traverse(childMod.url)),
    );
  }

  // ensure vite's import analysis is ready _only_ for top entries to not go too aggresive
  await Promise.all(entries.map((e) => devEnv.transformRequest(e)));

  // traverse
  await Promise.all(entries.map((url) => traverse(url)));

  // filter
  return [...visited].filter((url) => url.match(CSS_LANGS_RE));
}

// cf. https://github.com/vitejs/vite/blob/d6bde8b03d433778aaed62afc2be0630c8131908/packages/vite/src/node/constants.ts#L49C23-L50
const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
