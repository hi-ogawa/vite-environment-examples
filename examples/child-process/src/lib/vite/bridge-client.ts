import assert from "node:assert";
import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";
import type { BridgeClientOptions } from "./types";

export function createBridgeClient(options: BridgeClientOptions) {
  async function rpc(method: string, ...args: any[]): Promise<any> {
    const response = await fetch(options.bridgeUrl + "/rpc", {
      method: "POST",
      body: JSON.stringify({ method, args, key: options.key }),
    });
    assert(response.ok);
    const result = await response.json();
    return result;
  }

  let sseClient: Awaited<ReturnType<typeof createSSEClient>>;

  const runner = new ModuleRunner(
    {
      root: options.root,
      sourcemapInterceptor: "prepareStackTrace",
      transport: {
        async send(payload) {
          assert(sseClient);
          sseClient.send(payload);
        },
        async connect(handlers) {
          sseClient = await createSSEClient(
            options.bridgeUrl +
              "/sse?" +
              new URLSearchParams({ key: options.key }),
            handlers,
          );
        },
        timeout: 2000,
      },
      hmr: false,
    },
    new ESModulesEvaluator(),
  );

  async function handler(request: Request): Promise<Response> {
    try {
      const headers = request.headers;
      const meta = JSON.parse(headers.get("x-vite-meta")!);
      headers.delete("x-vite-meta");
      const mod = await runner.import(meta.entry);
      return mod.default(new Request(meta.url, { ...request, headers }));
    } catch (e) {
      console.error(e);
      const message =
        "[bridge client handler error]\n" +
        (e instanceof Error ? `${e.stack ?? e.message}` : "");
      return new Response(message, { status: 500 });
    }
  }

  return { runner, rpc, handler };
}

async function createSSEClient(
  url: string,
  handlers: {
    onMessage: (payload: any) => void;
    onDisconnection: () => void;
  },
) {
  const response = await fetch(url);
  assert(response.ok);
  const clientId = response.headers.get("x-client-id");
  assert(clientId);
  assert(response.body);
  response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(splitTransform("\n\n"))
    .pipeTo(
      new WritableStream({
        write(chunk) {
          // console.log("[client.response]", chunk);
          if (chunk.startsWith("data: ")) {
            const payload = JSON.parse(chunk.slice("data: ".length));
            handlers.onMessage(payload);
          }
        },
        abort(e) {
          console.log("[client.abort]", e);
        },
        close() {
          console.log("[client.close]");
          handlers.onDisconnection();
        },
      }),
    )
    .catch((e) => {
      console.log("[client.pipeTo.catch]", e);
    });

  return {
    send: async (payload: unknown) => {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "x-client-id": clientId,
        },
      });
      assert(response.ok);
      const result = await response.json();
      return result;
    },
  };
}

export function splitTransform(sep: string): TransformStream<string, string> {
  let pending = "";
  return new TransformStream({
    transform(chunk, controller) {
      while (true) {
        const i = chunk.indexOf(sep);
        if (i >= 0) {
          pending += chunk.slice(0, i);
          controller.enqueue(pending);
          pending = "";
          chunk = chunk.slice(i + sep.length);
          continue;
        }
        pending += chunk;
        break;
      }
    },
  });
}
