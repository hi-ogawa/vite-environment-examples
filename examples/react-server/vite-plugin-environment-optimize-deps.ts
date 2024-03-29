import { createDebug, tinyassert } from "@hiogawa/utils";
import {
  type Plugin,
  type PluginOption,
  type ResolvedConfig,
  resolveConfig,
  type DepOptimizationMetadata,
} from "vite";
import { optimizeDeps } from "vite";
import path from "node:path";
import fs from "node:fs";

const debug = createDebug("env-deps");

// temporary workaround for missing optimizeDeps.
// this also requires patch vite-5.2.6-patch-import-analysis.tgz
// to immitate noExternal for environment

export function vitePluginEnvironmentOptimizeDeps({
  name,
  force,
}: {
  name: string;
  force?: boolean;
}): PluginOption {
  let config: ResolvedConfig;
  let depsDir: string;
  let metadata: DepOptimizationMetadata;

  const plugin: Plugin = {
    name: vitePluginEnvironmentOptimizeDeps.name,
    enforce: "pre",
    apply: "serve",
    configResolved(config_) {
      config = config_;
    },
    async buildStart(_options) {
      const environment = config.environments[name];
      tinyassert(environment);
      // need to put outside of node_modules to make it treated as user code
      const cacheDir = path.join(config.root, "dist", ".env-deps", name);
      depsDir = path.join(cacheDir, "deps");
      const tmpConfig = await resolveConfig(
        {
          cacheDir,
          root: config.root,
          configFile: false,
          clearScreen: false,
          resolve: environment.resolve,
          optimizeDeps: {
            ...environment.dev.optimizeDeps,
            entries: [],
            noDiscovery: true,
          },
        },
        "serve",
      );
      await optimizeDeps(tmpConfig, force, true);
      const metadataFile = path.join(depsDir, "_metadata.json");
      metadata = JSON.parse(await fs.promises.readFile(metadataFile, "utf-8"));
    },
    resolveId(source, _importer, _options) {
      if (this.environment?.name === name) {
        const entry = metadata.optimized[source];
        debug("[resolveId]", { source, entry });
        if (entry) {
          return path.join(depsDir, entry.file);
        }
      }
      return;
    },
  };

  return [plugin];
}

export function vitePluginFixJsxDEV(): Plugin {
  return {
    name: vitePluginFixJsxDEV.name,
    apply: "serve",
    transform(code, _id, _options) {
      // import { jsxDEV } from "..."
      //   ⇓
      // import __jsxRuntime from "..."; const { jsxDEV } = __jsxRuntime;
      if (code.startsWith("import { jsxDEV }")) {
        const lines = code.split("\n");
        lines[0] = [
          "import __jsxRuntime",
          lines[0]!.slice("import { jsxDEV }".length),
          "const { jsxDEV } = __jsxRuntime",
        ].join("");
        return lines.join("\n");
      }
      return;
    },
  };
}
