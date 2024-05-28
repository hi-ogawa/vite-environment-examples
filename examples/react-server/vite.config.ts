import { resolve } from "node:path";
import { transformServerActionInline } from "@hiogawa/transforms";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import react from "@vitejs/plugin-react";
import {
  DevEnvironment,
  type Plugin,
  type PluginOption,
  createNodeDevEnvironment,
  createServerModuleRunner,
  defineConfig,
} from "vite";
import {
  ENTRY_BROWSER_BOOTSTRAP,
  vitePluginEntryBootstrap,
} from "./src/features/bootstrap/plugin";
import { transformServerAction } from "./src/features/server-action/plugin";
import { vitePluginServerCss } from "./src/features/style/plugin";
import { vitePluginTestReactServerStream } from "./src/features/test/plugin";
import { vitePluginSharedUnocss } from "./src/features/unocss/plugin";
import {
  createVirtualPlugin,
  parseExports,
  vitePluginSilenceDirectiveBuildWarning,
} from "./src/features/utils/plugin";
import { $__global } from "./src/global";

const debug = createDebug("app");

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    !process.env["VITEST"] && react(),
    vitePluginReactServer(),
    vitePluginSharedUnocss(),
    vitePluginLogger(),
    vitePluginSsrMiddleware({
      entry: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
      preview: resolve("./dist/ssr/index.js"),
    }),
    !!process.env["VITEST"] && vitePluginTestReactServerStream(),
  ],

  environments: {
    client: {
      dev: {
        optimizeDeps: {
          // [feedback] no optimizeDeps.entries for initial scan?
          // entries: []
        },
      },
      build: {
        outDir: "dist/client",
        minify: false,
        sourcemap: true,
        manifest: true,
        rollupOptions: {
          input: {
            index: ENTRY_BROWSER_BOOTSTRAP,
          },
        },
      },
    },
    ssr: {
      build: {
        outDir: "dist/ssr",
        sourcemap: true,
      },
    },
  },

  builder: {
    async buildApp(builder) {
      // pre-pass to collect all server/client references
      // by traversing server module graph and going over client boundary
      // TODO: this causes single plugin to be reused by two react-server builds
      manager.buildStep = "scan";
      await builder.build(builder.environments["react-server"]!);
      manager.buildStep = undefined;

      await builder.build(builder.environments["react-server"]!);
      await builder.build(builder.environments["client"]!);
      await builder.build(builder.environments["ssr"]!);
    },
  },

  test: {
    dir: "src",
  },
}));

// singleton to pass data through environment build
class ReactServerPluginManager {
  buildStep?: "scan";
  clientReferences = new Set<string>();
  serverReferences = new Set<string>();
}

export type { ReactServerPluginManager };

const manager: ReactServerPluginManager = ((
  globalThis as any
).__VITE_REACT_SERVER_MANAGER ??= new ReactServerPluginManager());

function vitePluginReactServer(): PluginOption {
  const environmentPlugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["react-server"] = {
        resolve: {
          conditions: ["react-server"],
          noExternal: true,
        },
        dev: {
          createEnvironment: createNodeDevEnvironment,
          optimizeDeps: {
            include: [
              "react",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-server-dom-webpack/server.edge",
            ],
          },
        },
        build: {
          outDir: "dist/react-server",
          sourcemap: true,
          ssr: true,
          emitAssets: true,
          manifest: true,
          rollupOptions: {
            input: {
              index: "/src/entry-server",
            },
          },
        },
      };
    },
    async configureServer(server) {
      const reactServerEnv = server.environments["react-server"];
      tinyassert(reactServerEnv);
      const reactServerRunner = createServerModuleRunner(reactServerEnv);
      $__global.server = server;
      $__global.reactServerRunner = reactServerRunner;
    },
    hotUpdate(ctx) {
      if (ctx.environment.name === "react-server") {
        const ids = ctx.modules.map((mod) => mod.id).filter(typedBoolean);
        if (ids.length > 0) {
          const invalidated =
            $__global.reactServerRunner.moduleCache.invalidateDepTree(ids);
          debug("[react-server:hotUpdate]", {
            ids,
            invalidated: [...invalidated],
          });
          // client reference id is also in react server module graph,
          // but we skip RSC HMR for this case since Client HMR handles it.
          if (!ids.some((id) => manager.clientReferences.has(id))) {
            console.log("[react-server:hmr]", ctx.file);
            $__global.server.environments.client.hot.send({
              type: "custom",
              event: "react-server:update",
              data: {
                file: ctx.file,
              },
            });
          }
          return [];
        }
      }
      return;
    },
  };

  return [
    environmentPlugin,
    vitePluginUseClient(),
    vitePluginSilenceDirectiveBuildWarning(),
    vitePluginServerAction(),
    vitePluginEntryBootstrap(),
    vitePluginServerCss({ manager }),
  ];
}

function vitePluginUseClient(): PluginOption {
  /*
    [input]

      "use client"
      export function Counter() {}

    [output]

      import { registerClientReference as $$register } from "...runtime..."
      export const Counter = $$register("<id>", "Counter");

  */
  const transformPlugin: Plugin = {
    name: vitePluginUseClient.name + ":transform",
    async transform(code, id, _options) {
      if (this.environment?.name === "react-server") {
        manager.clientReferences.delete(id);
        if (/^("use client")|('use client')/.test(code)) {
          manager.clientReferences.add(id);
          if (manager.buildStep === "scan") {
            return;
          }
          const { exportNames } = await parseExports(code);
          let result = `import { registerClientReference as $$register } from "/src/features/client-component/server";\n`;
          if (this.environment.mode === "dev") {
            id = await normalizeUrl(id, $__global.server.environments.client);
          }
          for (const name of exportNames) {
            result += `export const ${name} = $$register("${id}", "${name}");\n`;
          }
          debug(`[${vitePluginUseClient.name}:transform]`, {
            id,
            exportNames,
            result,
          });
          return { code: result, map: null };
        }
      }
      return;
    },
  };

  // need to align with what Vite import analysis would rewrite
  // to avoid double modules on browser and ssr.
  async function normalizeUrl(id: string, devEnv: DevEnvironment) {
    const transformed = await devEnv.transformRequest(
      "virtual:normalize-url/" + encodeURIComponent(id),
    );
    tinyassert(transformed);
    const m = transformed.code.match(/import\("(.*)"\)/);
    tinyassert(m && 1 in m);
    return m[1];
  }

  const normalizeUrlVirtualPlugin: Plugin = {
    name: vitePluginUseClient.name + "normalize-url-virtual",
    resolveId(source, _importer, _options) {
      if (source.startsWith("virtual:normalize-url/")) {
        return "\0" + source;
      }
      return;
    },
    load(id, _options) {
      if (id.startsWith("\0virtual:normalize-url/")) {
        id = id.slice("\0virtual:normalize-url/".length);
        id = decodeURIComponent(id);
        return `export default () => import("${id}")`;
      }
      return;
    },
  };

  /*
    [output]

      export default {
        "<id>": () => import("<id>"),
        ...
      }

  */
  const virtualPlugin: Plugin = createVirtualPlugin(
    "client-references",
    function () {
      tinyassert(this.environment?.name !== "react-server");
      tinyassert(this.environment?.mode === "build");
      return [
        `export default {`,
        ...Array.from(manager.clientReferences).map(
          (id) => `"${id}": () => import("${id}"),`,
        ),
        `}`,
      ].join("\n");
    },
  );

  return [transformPlugin, virtualPlugin, normalizeUrlVirtualPlugin];
}

function vitePluginServerAction(): PluginOption {
  /*
    [input]

      "use server"
      export function hello() {}

    [output] (react-server)

      export function hello() { ... }
      import { registerServerReference as $$register } from "...runtime..."
      hello = $$register(hello, "<id>", "hello");

    [output] (client)

      import { createServerReference as $$create } from "...runtime..."
      export const hello = $$create("<id>#hello");

  */
  const transformPlugin: Plugin = {
    name: vitePluginServerAction.name + ":transform",
    async transform(code, id) {
      // file directive
      if (/^("use server"|'use server')/.test(code)) {
        manager.serverReferences.add(id);
        const { output, exportNames } = await transformServerAction(code);
        if (this.environment?.name === "react-server") {
          output.append(
            [
              "",
              `import { registerServerReference as $$register } from "/src/features/server-action/server"`,
              ...exportNames.map(
                (name) =>
                  `${name} = typeof ${name} === "function" ? $$register(${name}, "${id}", "${name}") : ${name}`,
              ),
            ].join(";\n"),
          );
          return { code: output.toString(), map: output.generateMap() };
        } else {
          const runtime =
            this.environment?.name === "client" ? "browser" : "ssr";
          let result = `import { createServerReference as $$create } from "/src/features/server-action/${runtime}";\n`;
          for (const name of exportNames) {
            result += `export const ${name} = $$create("${id}#${name}");\n`;
          }
          return { code: result, map: null };
        }
      }
      // function directive
      if (
        this.environment?.name === "react-server" &&
        /("use server"|'use server')/.test(code)
      ) {
        const { output } = await transformServerActionInline(code, {
          id,
          runtime: "$$register",
        });
        if (output.hasChanged()) {
          manager.serverReferences.add(id);
          output.prepend(
            `import { registerServerReference as $$register } from "/src/features/server-action/server";\n`,
          );
          return { code: output.toString(), map: output.generateMap() };
        }
      }
      return;
    },
  };

  /*
    [output]

      export default {
        "<id>": () => import("<id>"),
        ...
      }

  */
  const virtualServerReference = createVirtualPlugin(
    "server-references",
    async function () {
      if (manager.buildStep === "scan") {
        return `export default {}`;
      }
      tinyassert(this.environment?.name === "react-server");
      tinyassert(this.environment.mode === "build");
      const ids = [...manager.serverReferences];
      return [
        "export default {",
        ...ids.map((id) => `"${id}": () => import("${id}"),\n`),
        "}",
      ].join("\n");
    },
  );

  const patchPlugin: Plugin = {
    name: "patch-react-server-dom-webpack",
    transform(code, id, _options) {
      if (
        this.environment?.name === "react-server" &&
        id.includes("react-server-dom-webpack")
      ) {
        // rename webpack markers in react server runtime
        // to avoid conflict with ssr runtime which shares same globals
        code = code.replaceAll(
          "__webpack_require__",
          "__vite_react_server_webpack_require__",
        );
        code = code.replaceAll(
          "__webpack_chunk_load__",
          "__vite_react_server_webpack_chunk_load__",
        );

        // make server reference async for simplicity (stale chunkCache, etc...)
        // see TODO in https://github.com/facebook/react/blob/33a32441e991e126e5e874f831bd3afc237a3ecf/packages/react-server-dom-webpack/src/ReactFlightClientConfigBundlerWebpack.js#L131-L132
        code = code.replaceAll("if (isAsyncImport(metadata))", "if (true)");
        code = code.replaceAll("4 === metadata.length", "true");

        return { code, map: null };
      }
      return;
    },
  };

  return [transformPlugin, virtualServerReference, patchPlugin];
}
