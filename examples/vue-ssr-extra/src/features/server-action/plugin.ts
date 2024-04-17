import { tinyassert } from "@hiogawa/utils";
import type { Plugin, PluginOption } from "vite";
import fs from "node:fs";
import path from "node:path";

// cf. examples/react-server/vite.config.ts

const USE_SERVER_RE = /^("use server")|('use server')/;

export function vitePluginServerAction(): PluginOption {
  const transformPlugin: Plugin = {
    name: vitePluginServerAction.name,
    transform(code, id, _options) {
      tinyassert(this.environment);
      if (USE_SERVER_RE.test(code)) {
        if (this.environment.name === "client") {
          // TODO: just find exports in examples/vue-ssr-extra/src/routes/server/_action.ts
          const matches = code.matchAll(/export async function (\w*)\(/g);
          const exportNames = [...matches].map((m) => m[1]!);
          return [
            `import { createServerReference as $$create } from "/src/features/server-action/client";`,
            ...exportNames.map(
              (name) => `export const ${name} = $$create("${id}", "${name}");`,
            ),
          ].join("\n");
        }
      }
      return;
    },
  };

  const virtualServerReference = createVirtualPlugin(
    "server-reference",
    async function () {
      tinyassert(this.environment?.name === "server");
      tinyassert(this.environment.mode === "build");
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

  return [transformPlugin, virtualServerReference];
}

async function collectFiles(baseDir: string) {
  const files: string[] = [];
  await traverseFiles(baseDir, async (filepath, e) => {
    if (e.isFile()) {
      files.push(filepath);
    }
    return e.isDirectory();
  });
  return files;
}

async function traverseFiles(
  dir: string,
  callback: (filepath: string, e: fs.Dirent) => Promise<boolean>,
) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const filepath = path.join(e.path, e.name);
    if (await callback(filepath, e)) {
      await traverseFiles(filepath, callback);
    }
  }
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
