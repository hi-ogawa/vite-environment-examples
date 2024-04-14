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

  async function evaluate(cmd: string) {
    if (!cmd.includes("return")) {
      cmd = `return ${cmd}`;
    }
    const entrySource = `export default async function({ env }) { ${cmd} }`;
    const entry = "virtual:repl/" + encodeURI(entrySource);
    await devEnv.api.eval(
      entry,
      async function (ctx: any, mod: any) {
        const result = await mod.default(ctx);
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
