import { createHash } from "node:crypto";
import path from "node:path";
import {
  transformDirectiveProxyExport,
  transformServerActionServer,
} from "@hiogawa/transforms";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import react from "@vitejs/plugin-react";
import {
  type Plugin,
  type PluginOption,
  type ResolvedConfig,
  createServerModuleRunner,
  defineConfig,
  parseAstAsync,
} from "vite";
import {
  ENTRY_BROWSER_BOOTSTRAP,
  vitePluginEntryBootstrap,
} from "./src/features/bootstrap/plugin";
import { vitePluginServerCss } from "./src/features/style/plugin";
import { vitePluginTestReactServerStream } from "./src/features/test/plugin";
import { vitePluginSharedUnocss } from "./src/features/unocss/plugin";
import {
  createVirtualPlugin,
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
      preview: path.resolve("./dist/ssr/index.js"),
      hmr: false,
    }),
    !!process.env["VITEST"] && vitePluginTestReactServerStream(),
  ],

  environments: {
    client: {
      optimizeDeps: {
        // [feedback] no optimizeDeps.entries for initial scan?
        // entries: []
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
          "react-server-dom-webpack/client.browser",
          "@hiogawa/utils",
        ],
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
      await builder.build(builder.environments["rsc"]!);
      manager.buildStep = undefined;

      await builder.build(builder.environments["rsc"]!);
      await builder.build(builder.environments["client"]!);
      await builder.build(builder.environments["ssr"]!);
    },
  },

  test: {
    dir: "src",
  },
}));

// singleton to survive multiple environment builds
class PluginStateManager {
  config!: ResolvedConfig;
  buildStep?: "scan";
  clientReferenceMap = new Map<string, string>();
  serverReferenceMap = new Map<string, string>();
}

export type { PluginStateManager };

if (!process.argv.includes("build")) {
  delete (globalThis as any).__VITE_REACT_SERVER_MANAGER;
}

const manager: PluginStateManager = ((
  globalThis as any
).__VITE_REACT_SERVER_MANAGER ??= new PluginStateManager());

function vitePluginReactServer(): PluginOption {
  const environmentPlugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["rsc"] = {
        resolve: {
          conditions: ["module", "react-server"],
          noExternal: true,
        },
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-server-dom-webpack/server.edge",
          ],
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
    configResolved(config) {
      manager.config = config;
    },
    async configureServer(server) {
      const reactServerEnv = server.environments["rsc"];
      tinyassert(reactServerEnv);
      // no hmr setup for custom node environment
      const reactServerRunner = createServerModuleRunner(reactServerEnv);
      $__global.server = server;
      $__global.reactServerRunner = reactServerRunner;
    },
    hotUpdate(ctx) {
      if (this.environment.name === "rsc") {
        const ids = ctx.modules.map((mod) => mod.id).filter(typedBoolean);
        if (ids.length > 0) {
          // client reference id is also in react server module graph,
          // but we skip RSC HMR for this case since Client HMR handles it.
          if (!ids.some((id) => manager.clientReferenceMap.has(id))) {
            debug("[react-server:hmr]", ctx.file);
            $__global.server.environments.client.hot.send({
              type: "custom",
              event: "react-server:update",
              data: {
                file: ctx.file,
              },
            });
          }
        }
      }
    },
  };

  return [
    environmentPlugin,
    vitePluginUseClient(),
    vitePluginSilenceDirectiveBuildWarning(),
    vitePluginServerAction(),
    vitePluginEntryBootstrap(),
    vitePluginServerCss({ manager }),
    virtualNormalizeUrlPlugin(),
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
      if (this.environment.name !== "rsc") {
        return;
      }
      manager.clientReferenceMap.delete(id);
      if (code.includes("use client")) {
        const runtimeId = await normalizeReferenceId(id, "client");
        const ast = await parseAstAsync(code);
        let output = await transformDirectiveProxyExport(ast, {
          directive: "use client",
          id: runtimeId,
          runtime: "$$register",
        });
        if (output) {
          manager.clientReferenceMap.set(id, runtimeId);
          if (manager.buildStep === "scan") {
            return;
          }
          output.prepend(
            `import { registerClientReference as $$register } from "/src/features/client-component/server";\n`,
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
  const virtualPlugin: Plugin = createVirtualPlugin(
    "client-references",
    function () {
      tinyassert(this.environment?.name !== "rsc");
      tinyassert(this.environment?.mode === "build");

      return [
        `export default {`,
        ...[...manager.clientReferenceMap.entries()].map(
          ([id, runtimeId]) => `"${runtimeId}": () => import("${id}"),\n`,
        ),
        `}`,
      ].join("\n");
    },
  );

  return [transformPlugin, virtualPlugin];
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

      import { createServerReference as $$proxy } from "...runtime..."
      export const hello = $$proxy("<id>", "hello");

  */
  const transformPlugin: Plugin = {
    name: vitePluginServerAction.name + ":transform",
    async transform(code, id) {
      if (!code.includes("use server") || id.includes("/.vite/deps/")) {
        return;
      }
      const ast = await parseAstAsync(code);
      tinyassert(this.environment);
      const runtimeId = await normalizeReferenceId(id, "rsc");
      if (this.environment.name === "rsc") {
        const { output } = await transformServerActionServer(code, ast, {
          id: runtimeId,
          runtime: "$$register",
        });
        if (output.hasChanged()) {
          manager.serverReferenceMap.set(id, runtimeId);
          output.prepend(
            `import { registerServerReference as $$register } from "/src/features/server-action/server";\n`,
          );
          return { code: output.toString(), map: output.generateMap() };
        }
      } else {
        let output = await transformDirectiveProxyExport(ast, {
          id: runtimeId,
          runtime: "$$proxy",
          directive: "use server",
        });
        if (output) {
          manager.serverReferenceMap.set(id, runtimeId);
          const runtime =
            this.environment.name === "client" ? "browser" : "ssr";
          output.prepend(
            `import { createServerReference as $$proxy } from "/src/features/server-action/${runtime}";\n`,
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
      tinyassert(this.environment?.name === "rsc");
      tinyassert(this.environment.mode === "build");
      return [
        "export default {",
        ...[...manager.serverReferenceMap.entries()].map(
          ([id, runtimeId]) => `"${runtimeId}": () => import("${id}"),\n`,
        ),
        "}",
      ].join("\n");
    },
  );

  const patchPlugin: Plugin = {
    name: "patch-react-server-dom-webpack",
    transform(code, id, _options) {
      if (
        this.environment?.name === "rsc" &&
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

        return { code, map: null };
      }
      return;
    },
  };

  return [transformPlugin, virtualServerReference, patchPlugin];
}

async function normalizeReferenceId(id: string, name: "client" | "rsc") {
  if (manager.config.command === "build") {
    return hashString(path.relative(manager.config.root, id));
  }

  // need to align with what Vite import analysis would rewrite
  // to avoid double modules on browser and ssr.
  const devEnv = $__global.server.environments[name];
  const transformed = await devEnv.transformRequest(
    "virtual:normalize-url/" + encodeURIComponent(id),
  );
  tinyassert(transformed);
  let runtimeId: string | undefined;
  switch (name) {
    case "client": {
      const m = transformed.code.match(/import\("(.*)"\)/);
      runtimeId = m?.[1];
      break;
    }
    case "rsc": {
      // `dynamicDeps` is available for ssrTransform
      runtimeId = transformed.dynamicDeps?.[0];
      break;
    }
  }
  tinyassert(runtimeId);
  return runtimeId;
}

function virtualNormalizeUrlPlugin(): Plugin {
  return {
    name: virtualNormalizeUrlPlugin.name,
    apply: "serve",
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
}

export function hashString(v: string) {
  return createHash("sha256").update(v).digest().toString("hex");
}
