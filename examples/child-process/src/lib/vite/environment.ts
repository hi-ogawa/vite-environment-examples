import assert from "node:assert";
import childProcess from "node:child_process";
import http from "node:http";
import { join } from "node:path";
import { webToNodeHandler } from "@hiogawa/utils-node";
import { DevEnvironment, type DevEnvironmentOptions } from "vite";

// TODO
// can we abstract away child process? FetchBridgeDevEnvironment?
// multiple children per env (like Vitest)? need different API?
export class ChildProcessFetchDevEnvironment extends DevEnvironment {
  public bridge!: http.Server;
  public bridgeUrl!: string;
  public child!: childProcess.ChildProcess;
  public childUrl!: string;
  public childUrlPromise!: PromiseWithResolvers<string>;

  static createFactory(options: {
    runtime: "node" | "bun";
    conditions?: string[];
  }): NonNullable<DevEnvironmentOptions["createEnvironment"]> {
    return (name, config) => {
      const command = [
        options.runtime === "node" ? ["node"] : [],
        options.runtime === "bun" ? ["bun", "run"] : [],
        options.conditions ? ["--conditions", ...options.conditions] : [],
        join(import.meta.dirname, `./runtime/${options.runtime}.js`),
      ].flat();
      return new ChildProcessFetchDevEnvironment({ command }, name, config, {
        // TODO
        hot: false,
      });
    };
  }

  constructor(
    public extraOptions: { command: string[] },
    ...args: ConstructorParameters<typeof DevEnvironment>
  ) {
    super(...args);
  }

  override init: DevEnvironment["init"] = async (...args) => {
    await super.init(...args);

    const listener = webToNodeHandler(async (request) => {
      const url = new URL(request.url);
      // TODO: other than json?
      if (url.pathname === "/rpc") {
        const { method, args } = await request.json();
        assert(method in this);
        const result = await (this as any)[method]!(...args);
        return Response.json(result);
      }
      return undefined;
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

    // TODO: separate child process concern?
    this.childUrlPromise = PromiseWithReoslvers();
    const command = this.extraOptions.command;
    const child = childProcess.spawn(
      command[0]!,
      [
        ...command.slice(1),
        JSON.stringify({
          bridgeUrl: this.bridgeUrl,
          root: this.config.root,
        }),
      ],
      {
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    this.child = child;
    await new Promise<void>((resolve, reject) => {
      child.on("spawn", () => {
        resolve();
      });
      child.on("error", (e) => {
        reject(e);
      });
    });
    this.childUrl = await this.childUrlPromise.promise;
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

  async dispatchFetch(entry: string, request: Request): Promise<Response> {
    const headers = new Headers(request.headers);
    headers.set("x-vite-meta", JSON.stringify({ entry, url: request.url }));
    const url = new URL(request.url);
    const childUrl = new URL(this.childUrl);
    url.host = childUrl.host;
    return fetch(new Request(url, { ...request, headers }));
  }

  /** @internal rpc for runner */
  async register(childUrl: string) {
    this.childUrlPromise.resolve(childUrl);
    return true;
  }
}

function PromiseWithReoslvers<T>(): PromiseWithResolvers<T> {
  let resolve: any;
  let reject: any;
  const promise = new Promise<any>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}
