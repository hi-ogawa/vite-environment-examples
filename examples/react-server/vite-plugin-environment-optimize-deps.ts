import { tinyassert } from "@hiogawa/utils";
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
          optimizeDeps: environment.dev.optimizeDeps,
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
        if (entry) {
          return path.join(depsDir, entry.file);
        }
      }
      return;
    },
  };

  return [plugin];
}
