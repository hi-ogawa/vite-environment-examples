import { tinyassert } from "@hiogawa/utils";
import type * as estree from "estree";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import * as periscopic from "periscopic";
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

export async function transformServerAction2(input: string, id: string) {
  const parsed = await parseAstAsync(input);
  const output = new MagicString(input);
  const analyzed = periscopic.analyze(parsed);
  const names: string[] = [];

  walk(parsed, {
    enter(node) {
      if (
        (node.type === "FunctionExpression" ||
          node.type === "FunctionDeclaration" ||
          node.type === "ArrowFunctionExpression") &&
        node.body.type === "BlockStatement" &&
        getFunctionDirective(node.body.body) === SERVER_DIRECTIVE
      ) {
        const scope = analyzed.map.get(node);
        tinyassert(scope);

        if (node.type === "FunctionDeclaration") {
          // top level function
          if (scope.parent === analyzed.scope) {
            names.push(node.id.name);
            return;
          }

          // otherwise lift closure by overwrite + move
          const liftName = `$$tmp_${names.length}_${node.id.name}`;
          names.push(liftName);
          const bindVars = [...scope.references].filter((ref) => {
            // function name itself is included as reference
            if (ref === node.id.name) {
              return false;
            }
            const owner = scope.find_owner(ref);
            return owner && owner !== scope && owner !== analyzed.scope;
          });
          const liftParams = [
            ...bindVars,
            ...node.params.map((n) => input.slice(n.start, n.end)),
          ].join(", ");
          output.overwrite(node.id.start, node.id.end, liftName);
          output.overwrite(node.id.end, node.body.start, `(${liftParams})`);
          output.appendRight(node.start, ";\n");
          output.move(node.start, node.end, input.length); // move to the end

          // replace original declartion with action bind
          const bindCode = `const ${node.id.name} = ${liftName}.bind(${[
            "null",
            ...bindVars,
          ].join(", ")});`;
          output.appendLeft(node.start, bindCode);
        }

        if (node.type === "ArrowFunctionExpression") {
          // TODO: not sure how to do top level function
          tinyassert(scope.parent !== analyzed.scope);

          // lift closure by overwrite + move
          const liftName = `$$tmp_${names.length}`;
          names.push(liftName);
          const bindVars = [...scope.references].filter((ref) => {
            const owner = scope.find_owner(ref);
            return owner && owner !== scope && owner !== analyzed.scope;
          });
          const liftParams = [
            ...bindVars,
            ...node.params.map((n) => input.slice(n.start, n.end)),
          ].join(", ");
          output.overwrite(
            node.start,
            node.body.start,
            `const ${liftName} = ${
              node.async ? "async " : ""
            }(${liftParams}) => `,
          );
          output.appendRight(node.start, ";\n");
          output.move(node.start, node.end, input.length); // move to the end

          // replace original declartion with action bind
          const bindParams = ["null", ...bindVars].join(", ");
          output.appendLeft(node.start, `${liftName}.bind(${bindParams})`);
        }
      }
    },
  });

  if (names.length === 0) {
    return;
  }

  output.append(";\n");
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
