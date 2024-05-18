import { tinyassert } from "@hiogawa/utils";
import MagicString from "magic-string";
import { parseAstAsync } from "vite";

// extend types for rollup ast with node position
declare module "estree" {
  interface BaseNode {
    start: number;
    end: number;
  }
}

export async function transformServerAction(input: string) {
  const parsed = await parseAstAsync(input);
  const output = new MagicString(input);
  const exportNames: string[] = [];

  function wrapExportName(localName: string, exportName = localName) {
    localName;
    exportName;
    exportNames.push(exportName);
  }

  for (const node of parsed.body) {
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        if (
          node.declaration.type === "FunctionDeclaration" ||
          node.declaration.type === "ClassDeclaration"
        ) {
          /**
           * export function foo() {}
           */
          wrapExportName(node.declaration.id.name);
        } else if (node.declaration.type === "VariableDeclaration") {
          /**
           * export const foo = 1, bar = 2
           */
          if (node.declaration.kind === "const") {
            // replace 'const' with 'let'
            output.update(
              node.declaration.start,
              node.declaration.start + 5,
              "let  ",
            );
          }
          for (const decl of node.declaration.declarations) {
            tinyassert(decl.id.type === "Identifier");
            wrapExportName(decl.id.name);
          }
        } else {
          node.declaration satisfies never;
        }
      } else {
        /**
         * export { foo, bar as car } from './foo'
         * export { foo, bar as car }
         */
        throw new Error("todo");
      }
    }

    /**
     * export * from './foo'
     */
    if (node.type === "ExportAllDeclaration") {
      throw new Error("todo");
    }

    /**
     * export default function foo() {}
     * export default class Foo {}
     * export default () => {}
     */
    if (node.type === "ExportDefaultDeclaration") {
      throw new Error("todo");
    }
  }

  return { output, exportNames };
}
