import { tinyassert } from "@hiogawa/utils";
import type { ModuleRunner } from "vite/module-runner";

export const RUNNER_INIT_PATH = "/__viteInit";
export const RUNNER_EVAL_PATH = "/__viteEval";
export const ANY_URL = "https://any.local";

export type RunnerEnv = {
  __viteRoot: string;
  __viteUnsafeEval: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunner: DurableObject;
};

export type RunnerFetchOptions = {
  entry: string;
};

const FETCH_OPTIONS_KEY = "__viteFetchOptions";

export function setRunnerFetchOptions(
  headers: Headers,
  options: RunnerFetchOptions,
): Headers {
  headers.set(FETCH_OPTIONS_KEY, encodeURIComponent(JSON.stringify(options)));
  return headers;
}

export function getRunnerFetchOptions(headers: Headers): RunnerFetchOptions {
  const raw = headers.get(FETCH_OPTIONS_KEY);
  tinyassert(raw);
  return JSON.parse(decodeURIComponent(raw));
}

export type EvalFn<In = any, Out = any> = (ctx: {
  mod: any;
  data: In;
  env: any;
  runner: ModuleRunner;
}) => Promise<Out> | Out;

export type EvalApi = <In = any, Out = any>(request: {
  entry: string;
  fn: EvalFn<In, Out>;
  data: In;
  cusotmSerialize?: boolean;
}) => Promise<Awaited<Out>>;

export type EvalMetadata = {
  entry: string;
  fnString: string;
  cusotmSerialize?: boolean;
};

export type EvalSerializer = {
  serialize: (data: any) => Promise<ReadableStream<Uint8Array>>;
  deserialize: (stream: ReadableStream<Uint8Array>) => Promise<any>;
};

export function jsonEvalSerializer(): EvalSerializer {
  return {
    serialize: async (data) => {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue(JSON.stringify(data));
          controller.close();
        },
      }).pipeThrough(new TextEncoderStream());
    },
    deserialize: async (stream) => {
      let output = "";
      await stream.pipeThrough(new TextDecoderStream()).pipeTo(
        new WritableStream({
          write(chunk) {
            output += chunk;
          },
        }),
      );
      return JSON.parse(output);
    },
  };
}
