import { parseAstAsync, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

export function vitePluginSilenceDirectiveBuildWarning(): Plugin {
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

//
// plugin utils
//

export function createVirtualPlugin(name: string, load: Plugin["load"]) {
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

//
// code transform utils
//

export async function parseExports(code: string) {
  const ast = await parseAstAsync(code);
  const exportNames = new Set<string>();
  let writableCode = code;
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
          if (node.declaration.kind === "const") {
            const start = (node.declaration as any).start;
            writableCode = replaceCode(writableCode, start, start + 5, "let  ");
          }
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === "Identifier") {
              exportNames.add(decl.id.name);
            }
          }
        }
      }
    }
  }
  return {
    exportNames,
    writableCode,
  };
}

function replaceCode(
  code: string,
  start: number,
  end: number,
  content: string,
) {
  return code.slice(0, start) + content + code.slice(end);
}

//
// fs utils
//

export async function traverseFiles(
  dir: string,
  callback: (filepath: string, e: fs.Dirent) => void,
) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const filepath = path.join(e.path, e.name);
    callback(filepath, e);
    if (e.isDirectory()) {
      await traverseFiles(filepath, callback);
    }
  }
}
