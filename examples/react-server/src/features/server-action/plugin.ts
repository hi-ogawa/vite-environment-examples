import { tinyassert } from "@hiogawa/utils";
import type * as estree from "estree";
import MagicString from "magic-string";
import { parseAstAsync } from "vite";

// TODO: unit test transform in isolation

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
  const output = new MagicString(input);

  // for starter, very primitive implementation to support simple cases in examples/react-server/src/routes/action/page.tsx
  // TODO: try scope analysis
  // - https://github.com/Rich-Harris/periscopic
  // - https://github.com/Rich-Harris/estree-walker
  // - https://github.com/Rich-Harris/zimmerframe
  // - https://github.com/Rich-Harris/is-reference
  // - https://github.com/vitejs/vite/blob/f71ba5b94a6e862460a96c7bf5e16d8ae66f9fe7/packages/vite/src/node/ssr/ssrTransform.ts#L17-L24

  for (const node of parsed.body) {
    // top level function
    if (node.type === "FunctionDeclaration") {
      // top level "use server" function
      if (getFunctionDirective(node.body.body) === SERVER_DIRECTIVE) {
        names.push(node.id.name);
      }
      // server component function
      if (/^[A-Z]/.test(node.id.name)) {
        let locals: string[] = [];
        for (const stmt of node.body.body) {
          // track variables
          if (stmt.type === "VariableDeclaration") {
            for (const decl of stmt.declarations) {
              if (decl.id.type === "Identifier") {
                locals.push(decl.id.name);
              }
            }
          }
          if (stmt.type === "FunctionDeclaration") {
            if (getFunctionDirective(stmt.body.body) === SERVER_DIRECTIVE) {
              // TODO: use MagicString.move to preserve sourcemap when lifting

              // filter local variables to bind (for now just substring match...)
              const bodyCode = input.slice(stmt.body.start, stmt.body.end);
              const localsToBind = locals.filter((name) =>
                bodyCode.includes(name),
              );

              // emit lift function
              const liftName = `$$lift_${node.id.name}_${stmt.id.name}`;
              const liftParams = [
                ...localsToBind,
                input.slice(stmt.params.at(0)!.start, stmt.params.at(-1)!.end),
              ].join(", ");
              names.push(liftName);
              output.append(
                `;\nasync function ${liftName}(${liftParams}) { ${bodyCode} };\n`,
              );

              // replace declartion with action bind
              output.overwrite(
                stmt.start,
                stmt.end,
                `const ${
                  stmt.id.name
                } = ${liftName}.bind(null, ${localsToBind.join(", ")})`,
              );
            }
          }
        }
      }
    }
  }

  if (names.length === 0) {
    return;
  }

  output.append("\n;\n");
  output.append(
    `import { registerServerReference as $$register } from "/src/features/server-action/server";\n`,
  );
  names.forEach((name) => {
    output.append(`${name} = $$register(${name}, "${id}", "${name}");\n`);
    output.append(`export { ${name} };\n`);
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
