// https://github.com/cloudflare/workers-sdk/blame/ad1d056cb2710b790ff5d4532e9f694e099c27e2/packages/miniflare/src/plugins/core/proxy/client.ts

// proxy only get/apply?
// everything async

// special names
//   global
//   import
// primitives
// function

// const client = new ProxyClient({ post });
// const runnerProxy = client.getRootProxy();
// const mod = await (await runnerProxy.import)("/src/entry");
// const res = await (await mod.default)(req);

// [with sync getter]
// const runnerProxy = client.getRootProxy();
// const mod = await runnerProxy.import("/src/entry");
// const res = await mod.default(req);

// const server = new ProxyServer({ on, root: { runner } });

export type ProxyTarget = {
  address: number;
};

// direct value to return
export type ProxyResult =
  | {
      type: "value";
      value: unknown;
    }
  | {
      type: "proxy";
      address: number;
    };

export class ProxyClient {
  constructor() {}

  async invokeCall(t: ProxyTarget, args: unknown[]) {
    t;
    args;
  }

  // sync fetch...?
  async invokeGet(t: ProxyTarget, p: keyof any) {
    t;
    p;
  }

  createProxy(t: ProxyTarget) {
    const client = this;
    return new Proxy(() => {}, {
      apply(_target, _thisArg, argArray) {
        return client.invokeCall(t, argArray);
      },
      get(_target, p, _receiver) {
        return client.invokeGet(t, p);
      },
    });
  }
}

// puppeteer/playwright style "handle" + "eval" system?
// https://playwright.dev/docs/evaluating

// const runner = createRemoteRunner();
// const modHandle = await runner.import("/some-entry.ts");
// const result = await runner.eval((mod) => mod.default("hello"), [modHandle]);

// const result = await runner.import("/some-entry.ts", (mod, args) => mod.default(...args), ["hello"]);

// const result = await remoteRunner.$eval("/some-module.ts", (mod, args) => ..., ["hello"]);
// const moduleHandle = remoteRunner.
