import type { ViteDevServer } from "vite";

// quick global hacks...

export const __global: {
  server: ViteDevServer;
  reactServer: ViteDevServer;
} = ((globalThis as any).__VITE_REACT_SERVER_GLOBAL ??= {});
