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
        name: "virtual-eval",
        resolveId(source, _importer, _options) {
          if (source.startsWith("virtual:eval/")) {
            return "\0" + source;
          }
          return;
        },
        load(id, _options) {
          if (id.startsWith("\0virtual:eval/")) {
            const cmd = id.slice("\0virtual:eval/".length);
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

  // evaluate command via virtual module
  async function evaluate(cmd: string) {
    if (!cmd.includes("return")) {
      cmd = `return ${cmd}`;
    }
    const entrySource = /* js */ `
      async function $$evaluate(env) {
        ${cmd}
      }
      export default {
        async fetch(request, env) {
          env = Object.fromEntries(
            Object.entries(env).filter(([k, v]) => !k.startsWith("__vite"))
          );
          const result = await $$evaluate(env);
          if (typeof result !== "undefined") {
            console.log(result);
          }
          return new Response(null);
        }
      }
    `;
    // TODO: we can invalidate virtual entry after eval
    const entry = "virtual:eval/" + encodeURI(entrySource);
    await devEnv.api.dispatchFetch(entry, new Request("https://any.local"));
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
