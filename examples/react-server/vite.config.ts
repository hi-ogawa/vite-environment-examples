import {
  defineConfig,
  createNodeEnvironment,
  type PluginOption,
  type Plugin,
  createServerModuleRunner,
  parseAstAsync,
} from "vite";
import { createDebug, tinyassert } from "@hiogawa/utils";
import { __global } from "./src/global";
// import react from "@vitejs/plugin-react";
import { vitePluginSsrMiddleware } from "../react-ssr/vite.config";
import { vitePluginEnvironmentOptimizeDeps } from "./vite-plugin-environment-optimize-deps";

const debug = createDebug("app");

export default defineConfig((env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    // TODO: only for client
    // react(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
      preview: new URL("./dist/server/index.js", import.meta.url).toString(),
    }),
    vitePluginReactServer(),
    vitePluginEnvironmentOptimizeDeps({
      name: "react-server",
    }),
  ],

  // [feedback] same as react-ssr
  define:
    env.command === "build"
      ? {
          "process.env.NODE_ENV": `"production"`,
        }
      : {},

  environments: {
    client: {
      build: {
        outDir: "dist/client",
        minify: false,
        sourcemap: true,
      },
    },
    server: {
      dev: {
        createEnvironment: (server) => createNodeEnvironment(server, "server"),
      },
      build: {
        createEnvironment(builder, name) {
          return {
            name,
            mode: "build",
            builder,
            config: {
              build: {
                outDir: "dist/server",
                sourcemap: true,
                // [feedback]
                // still a convenient flag to switch into SSR like build?
                // e.g. minify: false, modulePreload: false
                ssr: true,
                rollupOptions: {
                  input: {
                    index: process.env["SERVER_ENTRY"] ?? "/src/adapters/node",
                  },
                },
              },
            },
          };
        },
      },
    },
  },

  // [feedback] same as react-ssr
  build: env.isPreview ? { outDir: "dist/client" } : {},

  builder: {
    runBuildTasks: async (_builder, buildTasks) => {
      for (const task of buildTasks) {
        // [feedback] same as react-ssr
        Object.assign(
          task.config.build,
          task.config.environments[task.environment.name]?.build,
        );
        // [feedback] resolve also not working?
        debug("[build:config.resolve]", [
          task.environment.name,
          task.config.resolve,
          task.config.environments[task.environment.name]?.resolve,
        ]);
        Object.assign(
          task.config.resolve,
          task.config.environments[task.environment.name]?.resolve,
        );
      }

      debug(
        "[build]",
        buildTasks.map((t) => t.environment.name),
      );

      // [feedback] `buildTasks` should be object?
      const tasks = Object.fromEntries(
        buildTasks.map((t) => [t.environment.name, t]),
      );
      await tasks["react-server"].run();
      await tasks["client"].run();
      await tasks["server"].run();
    },
  },
}));

function vitePluginReactServer(): PluginOption {
  const plugin: Plugin = {
    name: vitePluginReactServer.name,
    config(config, _env) {
      tinyassert(config.environments);
      config.environments["react-server"] = {
        // [feedback] not working during build?
        resolve: {
          conditions: ["react-server"],
        },
        dev: {
          createEnvironment: (server) =>
            createNodeEnvironment(server, "react-server"),
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
          createEnvironment(builder, name) {
            return {
              name,
              mode: "build",
              builder,
              config: {
                // [feedback] workaround for environment.(name).build
                resolve: {
                  conditions: ["react-server"],
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
              },
            };
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
  };

  return [plugin, vitePluginUseClient()];
}

function vitePluginUseClient(): PluginOption {
  // react-server
  const transformPlugin: Plugin = {
    name: vitePluginUseClient.name + ":transform",
    async transform(code, id, _options) {
      if (this.environment?.name === "react-server") {
        if (/^("use client")|('use client')/.test(code)) {
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
          return result;
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
      return "todo";
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