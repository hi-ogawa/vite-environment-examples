import type { HotPayload } from "vite";

export const ANY_URL = "https://any.local";

export type RunnerEnv = {
  __viteRoot: string;
  __viteUnsafeEval: {
    eval: (code: string, filename?: string) => any;
  };
  __viteInvoke: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunnerSend: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunner: DurableObject;
};

export type RunnerRpc = {
  __viteInit: () => Promise<void>;
  __viteServerSend: (payload: HotPayload) => Promise<void>;
};

export type FetchMetadata = {
  entry: string;
};

export function requestJson(data: unknown) {
  return new Request(ANY_URL, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
