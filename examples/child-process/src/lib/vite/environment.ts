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
      const reqKey = new URL(request.url).searchParams.get("key");
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
  interface SSEClient {
    send(payload: HotPayload): void;
    close(): void;
  }

  const clientMap = new Map<string, SSEClient>();
  const listenerManager = createListenerManager();

  async function handler(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    if (url.pathname === "/sse") {
      // handle `send`
      const senderId = request.headers.get("x-client-id");
      if (senderId) {
        const client = clientMap.get(senderId);
        assert(client);
        const payload = await request.json();
        listenerManager.handle(payload, client);
        return Response.json({ ok: true });
      }
      // otherwise handle `connect`
      let controller: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({
        start: (controller_) => {
          controller = controller_;
          controller.enqueue(`:ping\n\n`);
        },
        cancel() {
          clientMap.delete(clientId);
        },
      });
      const pingInterval = setInterval(() => {
        controller.enqueue(`:ping\n\n`);
      }, 10_000);
      const clientId = Math.random().toString(36).slice(2);
      const client: SSEClient = {
        send(payload) {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        },
        close() {
          clearInterval(pingInterval);
          controller.close();
        },
      };
      clientMap.set(clientId, client);
      return new Response(stream, {
        headers: {
          "x-client-id": clientId,
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }
    return undefined;
  }

  const channel: HotChannel = {
    listen() {},
    close() {
      for (const client of clientMap.values()) {
        client.close();
      }
    },
    on: listenerManager.on,
    off: listenerManager.off,
    send: (payload) => {
      for (const client of clientMap.values()) {
        client.send(payload);
      }
    },
  };

  return { channel, handler };
}

// wrapper to simplify listener management
function createListenerManager(): Pick<HotChannel, "on" | "off"> & {
  handle: (
    payload: HotPayload,
    client: { send: (payload: HotPayload) => void },
  ) => void;
} {
  const listerMap: Record<string, Set<HotChannelListener>> = {};
  const getListerMap = (e: string) => (listerMap[e] ??= new Set());

  return {
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
    handle(payload, client) {
      if (payload.type === "custom") {
        for (const lister of getListerMap(payload.event)) {
          // TODO: type error of `payload.invoke`
          lister(payload.data, client, payload.invoke as any);
        }
      }
    },
  };
}
