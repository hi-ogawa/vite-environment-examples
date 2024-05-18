import fs from "node:fs";
import path from "node:path";
import { tinyassert } from "@hiogawa/utils";
import type { Plugin, PluginOption } from "vite";

// cf. examples/react-server/vite.config.ts

const USE_SERVER_RE = /^("use server"|'use server')/;

export function vitePluginServerAction(): PluginOption {
  const transformPlugin: Plugin = {
    name: vitePluginServerAction.name + ":transform",
    transform(code, id, _options) {
      // TOOD: use plugin.create to split plugins?
      tinyassert(this.environment);
      if (USE_SERVER_RE.test(code)) {
        // TODO: just find exports in examples/vue-ssr-extra/src/routes/server/_action.ts
        const matches = code.matchAll(/export async function (\w*)\(/g);
        const exportNames = [...matches].map((m) => m[1]!);
        if (this.environment.name === "client") {
          const outCode = [
            `import { createServerReference as $$create } from "/src/features/server-action/client";`,
            ...exportNames.map(
              (name) => `export const ${name} = $$create("${id}", "${name}");`,
            ),
          ].join("\n");
          return { code: outCode, map: null };
        } else {
          const outCode = [
            code,
            `import { registerServerReference as $$register } from "/src/features/server-action/shared";`,
            ...exportNames.map(
              (name) => `${name} = $$register(${name}, "${id}", "${name}");`,
            ),
          ].join("\n");
          return { code: outCode, map: null };
        }
      }
      return;
    },
  };

  const virtualServerReference = createVirtualPlugin(
    "server-references",
    async function () {
      const files = await collectFiles(path.resolve("./src"));
      const ids: string[] = [];
      for (const file of files) {
        const code = await fs.promises.readFile(file, "utf-8");
        if (USE_SERVER_RE.test(code)) {
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

  return [
    transformPlugin,
    virtualServerReference,
    vitePluginSilenceDirectiveBuildWarning(),
  ];
}

async function collectFiles(baseDir: string) {
  const files = await fs.promises.readdir(baseDir, {
    withFileTypes: true,
    recursive: true,
  });
  return files.filter((f) => f.isFile()).map((f) => path.join(f.path, f.name));
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

function vitePluginSilenceDirectiveBuildWarning(): Plugin {
  return {
    name: vitePluginSilenceDirectiveBuildWarning.name,
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
              (warning.message.includes(`"use client"`) ||
                warning.message.includes(`"use server"`))
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
