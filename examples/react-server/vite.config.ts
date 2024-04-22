import {
  defineConfig,
  createNodeDevEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
} from "vite";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { $__global } from "./src/global";
import react from "@vitejs/plugin-react";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import {
  collectFiles,
  createVirtualPlugin,
  parseExports,
  vitePluginSilenceDirectiveBuildWarning,
} from "./src/features/utils/plugin";
import fs from "node:fs";
import { resolve } from "node:path";

const debug = createDebug("app");

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginReactServer(),
    vitePluginSsrMiddleware({
      entry: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
      preview: resolve("./dist/server/index.js"),
    }),
  ],

  environments: {
    client: {
      build: {
        outDir: "dist/client",
        minify: false,
        sourcemap: true,
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

  return [transformPlugin, virtualServerReference];
}
