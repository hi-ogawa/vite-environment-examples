// https://github.com/cloudflare/workers-sdk/blame/ad1d056cb2710b790ff5d4532e9f694e099c27e2/packages/miniflare/src/workers/core/proxy.worker.ts#

import type { ProxyTarget } from "./client";

export class ProxyServer {
  heap = new Map<number, unknown>();
  heapInv = new WeakMap<object, number>();

  constructor() {}

  async handleCall(t: ProxyTarget, args: unknown[]) {
    t;
    args;
    t.address;
    this.heap.get(t.address);
  }

  async handleGet(t: ProxyTarget, p: keyof any) {
    this.heap.get(t.address);
    t;
    p;
  }
}
