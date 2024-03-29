import {
  defineConfig,
  createNodeDevEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  parseAstAsync,
} from "vite";
import { createDebug, tinyassert, typedBoolean } from "@hiogawa/utils";
import { __global } from "./src/global";
import react from "@vitejs/plugin-react";
import { vitePluginSsrMiddleware } from "../react-ssr/vite.config";
import {
  vitePluginEnvironmentOptimizeDeps,
  vitePluginFixJsxDEV,
} from "./vite-plugin-environment-optimize-deps";

const debug = createDebug("app");

export default defineConfig((env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: new URL("./dist/server/index.js", import.meta.url).toString(),
    }),
    vitePluginReactServer(),
    vitePluginEnvironmentOptimizeDeps({
      name: "react-server",
    }),
    vitePluginFixJsxDEV(),
    vitePluginSilenceUseClientBuildWarning(),
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
        ssr: true,
        rollupOptions: {
          input: {
            index: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
          },
        },
      },
    },
  },

  // [feedback] same as react-ssr
  build: env.isPreview ? { outDir: "dist/client" } : {},

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
  const plugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["react-server"] = {
        resolve: {
          conditions: ["react-server"],
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
          minify: false,
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
      const reactServerRunner = createServerModuleRunner(reactServerEnv);
      __global.server = server;
      __global.reactServerRunner = reactServerRunner;
    },
    // same as vitePluginSsrMiddleware
    hotUpdate(ctx) {
      if (ctx.environment.name === "react-server") {
        const ids = ctx.modules.map((mod) => mod.id).filter(typedBoolean);
        const invalidated =
          __global.reactServerRunner.moduleCache.invalidateDepTree(ids);
        debug("[react-server:hotUpdate]", {
          ids,
          invalidated: [...invalidated],
        });
        return [];
      }
      return;
    },
  };

  return [plugin, vitePluginUseClient()];
}

function vitePluginUseClient(): PluginOption {
  const transformPlugin: Plugin = {
    name: vitePluginUseClient.name + ":transform",
    async transform(code, id, _options) {
      if (this.environment?.name === "react-server") {
        if (/^("use client")|('use client')/.test(code)) {
          manager.clientReferences.add(id);
          const ast = await parseAstAsync(code);
          const exportNames = new Set<string>();
          for (const node of ast.body) {
            // named exports
            if (node.type === "ExportNamedDeclaration") {
              if (node.declaration) {
                if (
                  node.declaration.type === "FunctionDeclaration" ||
                  node.declaration.type === "ClassDeclaration"
                ) {
                  /**
                   * export function foo() {}
                   */
                  exportNames.add(node.declaration.id.name);
                } else if (node.declaration.type === "VariableDeclaration") {
                  /**
                   * export const foo = 1, bar = 2
                   */
                  for (const decl of node.declaration.declarations) {
                    if (decl.id.type === "Identifier") {
                      exportNames.add(decl.id.name);
                    }
                  }
                }
              }
            }
          }
          let result = `import { createClientReference } from "/src/features/use-client/react-server";\n`;
          for (const name of exportNames) {
            result += `export const ${name} = createClientReference("${id}", "${name}");\n`;
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

  return [
    transformPlugin,
    createVirtualPlugin("client-reference", function () {
      tinyassert(this.environment?.name !== "react-server");
      tinyassert(!this.meta.watchMode);
      let result = `export default {\n`;
      for (let id of manager.clientReferences) {
        result += `"${id}": () => import("${id}"),\n`;
      }
      result += "};\n";
      return result;
    }),
  ];
}

function createVirtualPlugin(name: string, load: Plugin["load"]) {
  name = "virtual:" + name;
  return {
    name: `virtual-${name}`,
    resolveId(source, _importer, _options) {
      return source === name ? "\0" + name : undefined;
    },
    load(id, options) {
      if (id === "\0" + name) {
        return (load as any).apply(this, [id, options]);
      }
    },
  } satisfies Plugin;
}

function vitePluginSilenceUseClientBuildWarning(): Plugin {
  return {
    name: vitePluginSilenceUseClientBuildWarning.name,
    apply: "build",
    enforce: "post",
    config: (config, _env) => ({
      build: {
        rollupOptions: {
          onwarn(warning, defaultHandler) {
            if (
              warning.code === "SOURCEMAP_ERROR" &&
              warning.message.includes("(1:0)")
            ) {
              return;
            }
            if (
              warning.code === "MODULE_LEVEL_DIRECTIVE" &&
              warning.message.includes(`"use client"`)
            ) {
              return;
            }
            if (config.build?.rollupOptions?.onwarn) {
              config.build.rollupOptions.onwarn(warning, defaultHandler);
            } else {
              defaultHandler(warning);
            }
          },
        },
      },
    }),
  };
}
