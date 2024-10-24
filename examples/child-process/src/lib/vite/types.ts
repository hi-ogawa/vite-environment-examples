import type { HotPayload } from "vite";

export interface BridgeClientOptions {
  bridgeUrl: string;
  root: string;
  key: string;
}

export interface InvokePayload {
  data: HotPayload;
  key: string;
}
