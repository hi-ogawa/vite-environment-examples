import repl from "node:repl";
import {
  type WorkerdDevEnvironment,
  createWorkerdDevEnvironment,
} from "@hiogawa/vite-plugin-workerd";
import { Log } from "miniflare";
import { createServer } from "vite";

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
          createEnvironment: (name, config) =>
            createWorkerdDevEnvironment(name, config, {
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
    const entrySource = `
      async function run(env) { ${cmd} };

      export default {
        async fetch(request, env) {
          const result = await run(env);
          if (typeof result !== "undefined") {
            console.log(result);
          }
          return new Response(null);
        }
      }
    `;
    const entry = "virtual:eval/" + encodeURI(entrySource);
    await devEnv.api.dispatchFetch(entry, new Request("http://localhost"));
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
