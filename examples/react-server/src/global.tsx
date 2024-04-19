import type { ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";
import type { CallServerCallback } from "./types";

// quick global hacks...

export const $__global: {
  server: ViteDevServer;
  reactServerRunner: ModuleRunner;
  callServer: CallServerCallback;
} = ((globalThis as any).__VITE_REACT_SERVER_GLOBAL ??= {});
