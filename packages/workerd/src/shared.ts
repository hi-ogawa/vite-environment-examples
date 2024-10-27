export const ANY_URL = "https://any.local";

export type RunnerEnv = {
  __viteRoot: string;
  __viteUnsafeEval: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunnerSend: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunner: DurableObject;
};

export type FetchMetadata = {
  entry: string;
};
