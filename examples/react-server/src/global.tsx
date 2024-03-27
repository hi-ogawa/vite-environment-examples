import type { ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";

// quick global hacks...

export const __global: {
  server: ViteDevServer;
  reactServerRunner: ModuleRunner;
} = ((globalThis as any).__VITE_REACT_SERVER_GLOBAL ??= {});
