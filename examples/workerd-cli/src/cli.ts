import { createServer } from "vite";
import {
  createWorkerdDevEnvironment,
  type WorkerdDevEnvironment,
} from "@hiogawa/vite-plugin-workerd";
import { Log } from "miniflare";
import repl from "node:repl";

async function main() {
  const server = await createServer({
    clearScreen: false,
    plugins: [
      {
        name: "virtual-repl",
        resolveId(source, _importer, _options) {
          if (source.startsWith("virtual:repl/")) {
            return "\0" + source;
          }
          return;
        },
        load(id, _options) {
          if (id.startsWith("\0virtual:repl/")) {
            const cmd = id.slice("\0virtual:repl/".length);
            return decodeURI(cmd);
          }
          return;
        },
      },
      {
        name: "virtual-workerd-env",
        resolveId(source, _importer, _options) {
          if (source === "virtual:workerd-env") {
            return "\0" + source;
          }
          return;
        },
        load(id, _options) {
          if (id === "\0virtual:workerd-env") {
            return `\
              export let env;
              export function _setEnv(_env) {
                env = _env;
              }
            `;
          }
          return;
        },
      },
    ],
    environments: {
      workerd: {
        resolve: {
          noExternal: true,
        },
        dev: {
          createEnvironment: (server, name) =>
            createWorkerdDevEnvironment(server, name, {
              miniflare: {
                log: new Log(),
              },
              wrangler: {
                configPath: "./wrangler.toml",
              },
            }),
        },
      },
    },
  });
  const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;

  // expose bindings via virtual module
  await devEnv.api.eval("virtual:workerd-env", async (ctx) => {
    ctx.exports["_setEnv"](ctx.env);
  });

  // evaluate command via virtual module
  async function evaluate(cmd: string) {
    if (!cmd.includes("return")) {
      cmd = `return ${cmd}`;
    }
    const entrySource = `
      import { env } from "virtual:workerd-env";
      export default async function() { ${cmd} };
    `;
    const entry = "virtual:repl/" + encodeURI(entrySource);
    await devEnv.api.eval(
      entry,
      async function (ctx) {
        const result = await ctx.exports["default"]();
        if (typeof result !== "undefined") {
          console.log(result);
        }
      },
      [],
    );
  }

  const replServer = repl.start({
    eval: async (cmd, _context, _filename, callback) => {
      try {
        await evaluate(cmd);
        (callback as any)(null);
      } catch (e) {
        callback(e as Error, null);
      }
    },
  });

  replServer.on("close", () => {
    server.close();
  });
}

main();
