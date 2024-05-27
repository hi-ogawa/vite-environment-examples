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
              // filter local variables to bind (for now just substring match...)
              const bodyCode = input.slice(stmt.body.start, stmt.body.end);
              const localsToBind = locals.filter((name) =>
                bodyCode.includes(name),
              );

              // lift function by overwrite + move
              const liftName = `$$lift_${node.id.name}_${stmt.id.name}`;
              names.push(liftName);
              const liftParams = [
                ...localsToBind,
                ...stmt.params.map((n) => input.slice(n.start, n.end)),
              ].join(", ");
              output.overwrite(stmt.id.start, stmt.id.end, liftName);
              output.overwrite(stmt.id.end, stmt.body.start, `(${liftParams})`);
              output.appendRight(stmt.start, ";\n");
              output.move(stmt.start, stmt.end, input.length);

              // replace original declartion with action bind
              const bindCode = `const ${
                stmt.id.name
              } = ${liftName}.bind(null, ${localsToBind.join(", ")});`;
              output.appendLeft(stmt.start, bindCode);
            }
          }
        }
      }
    }
  }

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

export async function transformServerAction3(input: string, id: string) {
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
        // TODO: for now function decl only
        tinyassert(node.type === "FunctionDeclaration");
        this.skip();

        const scope = analyzed.map.get(node);
        tinyassert(scope);

        // top level function
        if (scope.parent === analyzed.scope) {
          names.push(node.id.name);
          return;
        }

        // otherwise lift closure by overwrite + move
        const liftName = `$$tmp_${names.length}_${node.id.name}`;
        names.push(liftName);
        const bindVars = [...scope.references].filter((ref) => {
          // not sure why function name itself is reference
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
