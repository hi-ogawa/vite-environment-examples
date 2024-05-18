import { tinyassert } from "@hiogawa/utils";
import type * as estree from "estree";
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

  // only simple named exports for starter
  // see also
  // https://github.com/hi-ogawa/vite-plugins/blob/62b7523db0a1b148a14ea80131e451792987de51/packages/react-server/src/features/server-action/plugin.tsx
  // https://github.com/hi-ogawa/experiments/blob/09ee2efc92ca2b1e517dc388975c4dcce62c9fc0/vue-server/vite.config.ts

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

// TODO: can we refactor with above?
export async function transformServerAction2(input: string, id: string) {
  const parsed = await parseAstAsync(input);
  const names: string[] = [];

  // only non-exported top-level function for starter
  // TODO
  // need to track scope (free variable) and traverse all function
  // probably should borrow some tools e.g.
  // - https://github.com/Rich-Harris/estree-walker
  // - https://github.com/Rich-Harris/periscopic
  // - https://github.com/Rich-Harris/zimmerframe

  for (const node of parsed.body) {
    if (node.type === "FunctionDeclaration") {
      if (getFunctionDirective(node.body.body) === SERVER_DIRECTIVE) {
        names.push(node.id.name);
      }
    }
  }

  if (names.length === 0) {
    return;
  }

  const output = new MagicString(input);
  output.append("\n;\n");
  output.append(
    `import { registerServerReference as $$register } from "/src/features/server-action/server";\n`,
  );
  names.forEach((name, i) => {
    const exportName = `$$fn_${i}_${name}`;
    output.append(`${name} = $$register(${name}, "${id}", "${exportName}");\n`);
    output.append(`export { ${name} as ${exportName} };\n`);
  });

  return output;
}

function getFunctionDirective(body: estree.Statement[]): string | undefined {
  const stmt = body[0];
  if (
    stmt &&
    stmt.type === "ExpressionStatement" &&
    stmt.expression.type === "Literal" &&
    typeof stmt.expression.value === "string"
  ) {
    return stmt.expression.value;
  }
  return;
}

const SERVER_DIRECTIVE = "use server";
