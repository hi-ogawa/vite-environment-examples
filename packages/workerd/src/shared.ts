import { tinyassert } from "@hiogawa/utils";

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

export type EvalFn = (ctx: { mod: any; args: any[]; env: any }) => any;

export type EvalApi = (request: {
  entry: string;
  fn: EvalFn;
  args: any[];
  serializerEntry?: string;
  serializer?: EvalSerializer;
}) => Promise<any>;

export type EvalMetadata = {
  entry: string;
  fnString: string;
  serializerEntry?: string;
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
