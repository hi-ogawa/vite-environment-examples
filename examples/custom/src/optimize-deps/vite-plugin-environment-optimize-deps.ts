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

// temporary workaround for missing optimizeDeps
// TODO: noExternal is also required but fixed by patch in vite-5.2.6-patch.tgz

export function vitePluginEnvironmentOptimizeDeps({
  name,
  force,
}: {
  name: string;
  force?: boolean;
}): PluginOption {
  let config: ResolvedConfig;
  let cacheDir: string;
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
      cacheDir = path.join(config.cacheDir, ".env-deps", name);
      const tmpConfig = await resolveConfig(
        {
          cacheDir,
          root: config.root,
          configFile: false,
          resolve: environment.resolve,
          optimizeDeps: environment.dev.optimizeDeps,
        },
        "serve",
        "development",
        "development",
      );
      await optimizeDeps(tmpConfig, force, true);

      const metadataFile = path.join(cacheDir, "deps", "_metadata.json");
      metadata = JSON.parse(await fs.promises.readFile(metadataFile, "utf-8"));
    },
    resolveId(source, _importer, _options) {
      if (this.environment?.name === name) {
        const entry = metadata.optimized[source];
        if (entry) {
          return path.join(cacheDir, "deps", entry.file)
        }
      }
      return;
    },
  };

  return [plugin]
}
