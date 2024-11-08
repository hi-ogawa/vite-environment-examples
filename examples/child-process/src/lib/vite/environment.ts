import assert from "node:assert";
import childProcess from "node:child_process";
import http from "node:http";
import { join } from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { webToNodeHandler } from "@hiogawa/utils-node";
import { DevEnvironment, type DevEnvironmentOptions } from "vite";
import { createSSEServerTransport } from "./sse-server";
import type { BridgeClientOptions } from "./types";

// TODO
// can we abstract away child process? FetchBridgeDevEnvironment?
// multiple children per env (like Vitest)? need different API?
export class ChildProcessFetchDevEnvironment extends DevEnvironment {
  public bridge!: http.Server;
  public bridgeUrl!: string;
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
    super(name, config, {
      hot: false,
      transport: createSSEServerTransport(),
    });
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
      return this.hot.api.handler(request);
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
