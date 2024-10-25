import assert from "node:assert";
import childProcess from "node:child_process";
import http from "node:http";
import { join } from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { webToNodeHandler } from "@hiogawa/utils-node";
import {
  DevEnvironment,
  type DevEnvironmentOptions,
  type HotChannel,
  type HotChannelListener,
  type HotPayload,
} from "vite";
import type { BridgeClientOptions } from "./types";

// TODO
// can we abstract away child process? FetchBridgeDevEnvironment?
// multiple children per env (like Vitest)? need different API?
export class ChildProcessFetchDevEnvironment extends DevEnvironment {
  public bridge!: http.Server;
  public bridgeUrl!: string;
  public bridgeSse: ReturnType<typeof createHMRChannelSSEHandler>;
  public child!: childProcess.ChildProcess;
  public childUrl!: string;

  static createFactory(options: {
    runtime: "node" | "bun";
    conditions?: string[];
  }): NonNullable<DevEnvironmentOptions["createEnvironment"]> {
    return (name, config) => {
      const command = [
        options.runtime === "node" ? ["node", "--import", "tsx/esm"] : [],
        options.runtime === "bun" ? ["bun", "run"] : [],
        options.conditions ? ["--conditions", ...options.conditions] : [],
        join(import.meta.dirname, `./runtime/${options.runtime}.js`),
      ].flat();
      return new ChildProcessFetchDevEnvironment({ command }, name, config);
    };
  }

  constructor(
    public extraOptions: { command: string[] },
    name: ConstructorParameters<typeof DevEnvironment>[0],
    config: ConstructorParameters<typeof DevEnvironment>[1],
  ) {
    const bridgeSse = createHMRChannelSSEHandler();
    super(name, config, { hot: false, transport: bridgeSse.channel });
    this.bridgeSse = bridgeSse;
  }

  override init: DevEnvironment["init"] = async (...args) => {
    await super.init(...args);

    // protect bridge rpc
    const key = Math.random().toString(36).slice(2);

    const listener = webToNodeHandler(async (request) => {
      const reqKey = request.headers.get("x-key");
      if (reqKey !== key) {
        return Response.json({ message: "invalid key" }, { status: 400 });
      }
      return this.bridgeSse.handler(request);
    });

    const bridge = http.createServer((req, res) => {
      listener(req, res, (e) => {
        console.error(e);
        res.statusCode = 500;
        res.end("Internal server error");
      });
    });
    this.bridge = bridge;

    await new Promise<void>((resolve, reject) => {
      bridge.listen(() => {
        const address = bridge.address();
        assert(address && typeof address !== "string");
        this.bridgeUrl = `http://localhost:${address.port}`;
        resolve();
      });
      bridge.on("error", (e) => {
        console.error(e);
        reject(e);
      });
    });

    const command = this.extraOptions.command;
    const child = childProcess.spawn(
      command[0]!,
      [
        ...command.slice(1),
        JSON.stringify({
          bridgeUrl: this.bridgeUrl,
          root: this.config.root,
          key,
        } satisfies BridgeClientOptions),
      ],
      {
        // 4th stdio to ease startup communication
        // TODO: use 1st stdio to make bidirection?
        // https://github.com/cloudflare/workers-sdk/blob/e5037b92ac13b1b8a94434e1f9bfa70d4abf791a/packages/miniflare/src/runtime/index.ts#L141
        stdio: ["ignore", "inherit", "inherit", "pipe"],
      },
    );
    this.child = child;
    assert(child.stdio[3] instanceof Readable);
    const childOut = readline.createInterface(child.stdio[3]);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Child process startup timeout")),
        10_000,
      );
      child.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      childOut.once("line", (line) => {
        clearTimeout(timeout);
        try {
          const event = JSON.parse(line);
          assert(event.type === "register");
          this.childUrl = `http://localhost:${event.port}`;
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    console.log("[environment.init]", {
      bridgeUrl: this.bridgeUrl,
      childUrl: this.childUrl,
    });
  };

  override close: DevEnvironment["close"] = async (...args) => {
    await super.close(...args);
    this.child?.kill();
    this.bridge?.close();
  };

  // TODO: would be more complicated to do proper proxy?
  // https://github.com/cloudflare/workers-sdk/blob/e5037b92ac13b1b8a94434e1f9bfa70d4abf791a/packages/miniflare/src/index.ts#L1602
  async dispatchFetch(entry: string, request: Request): Promise<Response> {
    const headers = new Headers(request.headers);
    headers.set("x-vite-meta", JSON.stringify({ entry, url: request.url }));
    const url = new URL(request.url);
    const childUrl = new URL(this.childUrl);
    url.host = childUrl.host;
    return fetch(new Request(url, { ...request, headers, redirect: "manual" }));
  }
}

// SSE utility partially from
// https://github.com/hi-ogawa/js-utils/blob/ee42942580f19abea710595163e55fb522061e99/packages/tiny-rpc/src/message-port/server-sent-event.ts

function createHMRChannelSSEHandler() {
  const clientSet = new Set<SSEClientProxy>();
  let listener: (payload: HotPayload, client: SSEClientProxy) => void;

  async function handler(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      console.log("[/connect]");
      const client = createSSEClientProxy(request, {
        onMessage(payload) {
          listener(payload, client);
        },
      });
      clientSet.add(client);
      return client.response;
    }
    return undefined;
  }

  const channel = createGroupedHMRChannel({
    sendAll(payload) {
      for (const client of clientSet) {
        client.send(payload);
      }
    },
    on(listener_) {
      listener = listener_;
      return () => {
        for (const client of clientSet) {
          client.close();
        }
      };
    },
  });

  return { channel, handler };
}

type SSEClientProxy = ReturnType<typeof createSSEClientProxy>;

function createSSEClientProxy(
  request: Request,
  handlers: {
    onMessage: (payload: any) => void;
  },
) {
  assert(request.body);
  request.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(splitTransform("\n\n"))
    .pipeTo(
      new WritableStream({
        write(chunk) {
          console.log("[client-proxy.write]", chunk);
          if (chunk.startsWith("data: ")) {
            const payload = JSON.parse(chunk.slice("data: ".length));
            handlers.onMessage(payload);
          }
        },
        abort(e) {
          if (0) console.log("[client-proxy.abort]", e);
        },
        close() {
          console.log("[client-proxy.close]");
        },
      }),
    )
    .catch((e) => {
      if (0) console.log("[client-proxy.pipeTo.catch]", e);
    });

  let responseController: ReadableStreamDefaultController<string>;
  const responseStream = new ReadableStream<string>({
    start: (controller) => {
      responseController = controller;
      responseController.enqueue(`:ping\n\n`);
    },
  }).pipeThrough(new TextEncoderStream());
  const response = new Response(responseStream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });

  const intervalId = setInterval(() => {
    responseController.enqueue(`:ping\n\n`);
  }, 5_000);

  return {
    response,
    send(data: any) {
      responseController.enqueue(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(intervalId);
    },
  };
}

function splitTransform(sep: string): TransformStream<string, string> {
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

// helper to manage listeners by event types
function createGroupedHMRChannel(options: {
  sendAll: (payload: HotPayload) => void;
  on: (
    listener: (
      payload: HotPayload,
      client: { send: (payload: HotPayload) => void },
    ) => void,
  ) => () => void;
}): HotChannel {
  const listerMap: Record<string, Set<HotChannelListener>> = {};
  const getListerMap = (e: string) => (listerMap[e] ??= new Set());
  let dispose: () => void;

  return {
    listen() {
      dispose = options.on((payload, client) => {
        if (payload.type === "custom") {
          for (const lister of getListerMap(payload.event)) {
            // TODO: type error of `payload.invoke`
            lister(payload.data, client, payload.invoke as any);
          }
        }
      });
    },
    close() {
      dispose();
    },
    on(event: string, listener: HotChannelListener) {
      // console.log("[channel.on]", event, listener);
      if (event === "connection") {
        return;
      }
      getListerMap(event).add(listener);
    },
    off(event, listener: any) {
      // console.log("[channel.off]", event, listener);
      if (event === "connection") {
        return;
      }
      getListerMap(event).delete(listener);
    },
    send: options.sendAll,
  };
}
