import fs from "node:fs";
import { resolve } from "node:path";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import react from "@vitejs/plugin-react";
import {
  type Plugin,
  type PluginOption,
  createNodeDevEnvironment,
  createServerModuleRunner,
  defineConfig,
} from "vite";
import {
  ENTRY_CLIENT_BOOTSTRAP,
  vitePluginEntryBootstrap,
} from "./src/features/bootstrap/plugin";
import { vitePluginTestReactServerStream } from "./src/features/test/plugin";
import {
  collectFiles,
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
    vitePluginLogger(),
    vitePluginSsrMiddleware({
      entry: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
      preview: resolve("./dist/server/index.js"),
    }),
    !!process.env["VITEST"] && vitePluginTestReactServerStream(),
  ],

  environments: {
    client: {
      build: {
        outDir: "dist/client",
        minify: false,
        sourcemap: true,
        manifest: true,
        rollupOptions: {
          input: {
            index: ENTRY_CLIENT_BOOTSTRAP,
          },
        },
      },
    },
    ssr: {
      build: {
        outDir: "dist/server",
        sourcemap: true,
      },
    },
  },

  builder: {
    async buildEnvironments(builder, build) {
      await build(builder.environments["react-server"]!);
      await build(builder.environments["client"]!);
      await build(builder.environments["ssr"]!);
    },
  },

  test: {
    dir: "src",
  },
}));

// singleton to pass data through environment build
class ReactServerManager {
  public clientReferences = new Set<string>();
}

const manager: ReactServerManager = ((
  globalThis as any
).__VITE_REACT_SERVER_MANAGER ??= new ReactServerManager());

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
          rollupOptions: {
            input: {
              index: "/src/entry-react-server",
            },
          },
        },
      };
    },
    async configureServer(server) {
      const reactServerEnv = server.environments["react-server"];
      tinyassert(reactServerEnv);
      const reactServerRunner = createServerModuleRunner(
        server,
        reactServerEnv,
      );
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
          const { exportNames } = await parseExports(code);
          let result = `import { registerClientReference as $$register } from "/src/features/use-client/react-server";\n`;
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

  /*
    [output]

      export default {
        "<id>": () => import("<id>"),
        ...
      }

  */
  const virtualPlugin: Plugin = createVirtualPlugin(
    "client-reference",
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

      import { createServerReference as $$create } from "...runtime..."
      export const hello = $$create("<id>#hello");

  */
  const transformPlugin: Plugin = {
    name: vitePluginServerAction.name + ":transform",
    async transform(code, id) {
      if (/^("use server")|('use server')/.test(code)) {
        const { exportNames, writableCode } = await parseExports(code);
        if (this.environment?.name === "react-server") {
          let result = writableCode;
          result += `import { registerServerReference as $$register } from "/src/features/server-action/react-server";\n`;
          for (const name of exportNames) {
            result += `${name} = $$register(${name}, "${id}", "${name}");\n`;
          }
          return { code: result, map: null };
        } else {
          const runtime =
            this.environment?.name === "client" ? "browser" : "server";
          let result = `import { createServerReference as $$create } from "/src/features/server-action/${runtime}";\n`;
          for (const name of exportNames) {
            result += `export const ${name} = $$create("${id}#${name}");\n`;
          }
          return { code: result, map: null };
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
    "server-reference",
    async function () {
      tinyassert(this.environment?.name === "react-server");
      tinyassert(this.environment.mode === "build");
      const files = await collectFiles(resolve("./src"));
      const ids: string[] = [];
      for (const file of files) {
        const code = await fs.promises.readFile(file, "utf-8");
        if (/^("use server")|('use server')/.test(code)) {
          ids.push(file);
        }
      }
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
        code = code.replaceAll("4===a.length", "true");

        return { code, map: null };
      }
      return;
    },
  };

  return [transformPlugin, virtualServerReference, patchPlugin];
}
